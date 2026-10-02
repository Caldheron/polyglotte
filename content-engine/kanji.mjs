#!/usr/bin/env node
// Construit public/kanji-n5.json à partir de KANJIDIC2 (dictionnaire de kanji de l'EDRDG, licence CC BY-SA).
// Les kanji, lectures et sens viennent du dictionnaire : aucun modèle de langue n'intervient.
// « jlpt 4 » dans KANJIDIC2 = ancienne échelle à 4 niveaux = l'actuel N5 (environ 80 kanji).
// Usage : node content-engine/kanji.mjs        (test local : --fichier kanjidic2.xml)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const niveau = opt('niveau', '4');

let xml;
if (opt('fichier')) xml = await readFile(opt('fichier'), 'utf8');
else {
  try {
    const r = await fetch('https://www.edrdg.org/kanjidic/kanjidic2.xml.gz', { headers: { 'User-Agent': 'Polyglotte-PWA/1.0 (apprentissage personnel)' }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    xml = gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8');
  } catch (e) {
    console.error(`Téléchargement de KANJIDIC2 impossible (${e.message}). Télécharge kanjidic2.xml.gz sur edrdg.org, décompresse-le, puis : node content-engine/kanji.mjs --fichier chemin/kanjidic2.xml`);
    process.exit(1);
  }
}

const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const tous = (b, re) => [...b.matchAll(new RegExp(re, 'gu'))].map((m) => dec(m[1]));
const kun = (r) => { const t = r.replace(/^-|-$/g, ''); return t.includes('.') ? t.replace('.', '（') + '）' : t; }; // た.べる → た（べる）

const kanji = [];
let sansFrancais = 0;
for (const b of xml.split('<character>').slice(1)) {
  if (tous(b, '<jlpt>(\\d)</jlpt>')[0] !== niveau) continue;
  const lit = tous(b, '<literal>(.)</literal>')[0];
  const on = tous(b, '<reading r_type="ja_on">([^<]+)<'), kn = tous(b, '<reading r_type="ja_kun">([^<]+)<');
  const fr = tous(b, '<meaning m_lang="fr">([^<]+)<'), en = tous(b, '<meaning>([^<]+)<');
  if (!fr.length) sansFrancais++;
  kanji.push({
    id: `ja-k-${lit}`, term: lit,
    lecture: [on.length ? `音 ${on.join('、')}` : '', kn.length ? `訓 ${kn.map(kun).join('、')}` : ''].filter(Boolean).join(' · '),
    gloss: fr.length ? fr.slice(0, 4).join(', ') : `${en.slice(0, 4).join(', ')} (en)`,
    example: '', exampleGloss: '',
    strokes: Number(tous(b, '<stroke_count>(\\d+)<')[0] ?? 0), freq: Number(tous(b, '<freq>(\\d+)<')[0] ?? 9999)
  });
}
if (!kanji.length) { console.error('Aucun kanji trouvé pour ce niveau : fichier inattendu ?'); process.exit(1); }
kanji.sort((a, c) => a.freq - c.freq); // les plus fréquents d'abord

const sortie = path.join(ICI, '..', 'public', 'kanji-n5.json');
await mkdir(path.dirname(sortie), { recursive: true });
await writeFile(sortie, JSON.stringify({ version: 1, source: 'KANJIDIC2 (EDRDG, licence CC BY-SA)', niveau: 'N5', genere: new Date().toISOString(), kanji }, null, 2));
console.log(`${kanji.length} kanji écrits dans ${sortie}${sansFrancais ? ` — ${sansFrancais} sans traduction française (sens anglais, marqués « (en) »)` : ''}`);
