#!/usr/bin/env node
// Construit public/zh-vocab.json (cartes de vocabulaire chinois) à partir de CFDICT et d'une LISTE DE MOTS fournie par toi.
// Pinyin, sens et caractères viennent du dictionnaire : aucun modèle de langue n'intervient.
// Données : CFDICT par Chine Informations (https://chine.in), licence CC BY-SA 3.0. Mention à conserver dans l'app et le README.
// Usage : node content-engine/dico-zh.mjs                         (lit donnees/cfdict.u8 et donnees/mots-zh.txt)
//   options : --dico <fichier.u8>  --liste <mots.txt>  --sortie <fichier.json>
// mots-zh.txt : un mot en chinois simplifié par ligne (le reste de la ligne après une tabulation est ignoré ; # = commentaire).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const fDico = path.resolve(RACINE, opt('dico', 'donnees/cfdict.u8'));
const fListe = path.resolve(RACINE, opt('liste', 'donnees/mots-zh.txt'));
const fSortie = path.resolve(RACINE, opt('sortie', 'public/zh-vocab.json'));

// pinyin numérique (ni3 hao3, nu:3) -> tons en diacritiques (nǐ hǎo, nǚ)
const MARQUES = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
export function syllabe(s) {
  const m = /^([A-Za-zü:Ü]+?)([1-5])?$/.exec(s);
  if (!m) return s;
  const base = m[1].replace(/u:/gi, 'ü'), t = m[2];
  if (!t || t === '5') return base;
  const bas = base.toLowerCase();
  let i = bas.search(/[ae]/);                       // a et e portent toujours la marque
  if (i < 0 && bas.includes('ou')) i = bas.indexOf('ou'); // ou : sur le o
  if (i < 0) for (let k = bas.length - 1; k >= 0; k--) if ('aeiouü'.includes(bas[k])) { i = k; break; } // sinon dernière voyelle
  if (i < 0) return base;
  const marque = MARQUES[bas[i]][+t - 1];
  return base.slice(0, i) + (base[i] !== bas[i] ? marque.toUpperCase() : marque) + base.slice(i + 1);
}
export const pinyin = (py) => py.trim().split(/\s+/).map(syllabe).join(' ');

async function main() {
  let u8, liste;
  try { u8 = await readFile(fDico, 'utf8'); } catch { console.error(`Dictionnaire introuvable : ${fDico}\nTélécharge cfdict.u8 depuis https://chine.in/mandarin/dictionnaire/CFDICT/ dans le dossier donnees/.`); process.exit(1); }
  try { liste = await readFile(fListe, 'utf8'); } catch { console.error(`Liste de mots introuvable : ${fListe}\nCrée ce fichier : un mot en chinois simplifié par ligne.`); process.exit(1); }

  const dico = new Map(); // simplifié -> [{ py, sens }]
  for (const l of u8.split(/\r?\n/)) {
    if (!l || l.startsWith('#')) continue;
    const m = /^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/\s*$/.exec(l);
    if (!m) continue;
    const e = { py: m[3], sens: m[4].split('/').map((x) => x.trim()).filter(Boolean) };
    const a = dico.get(m[2]) ?? [];
    if (!a.some((x) => x.py === e.py && x.sens.join('/') === e.sens.join('/'))) a.push(e);
    dico.set(m[2], a);
  }

  const mots = [], absents = [], multiples = [], vus = new Set();
  for (const brut of liste.split(/\r?\n/)) {
    const w = brut.split('\t')[0].trim();
    if (!w || w.startsWith('#') || vus.has(w)) continue;
    vus.add(w);
    const es = dico.get(w);
    if (!es) { absents.push(w); continue; }
    if (es.length > 1) multiples.push(`${w} : ${es.map((e) => pinyin(e.py)).join(' / ')}`);
    mots.push({
      id: `zh-m-${w}`, term: w,
      pinyin: [...new Set(es.map((e) => pinyin(e.py)))].join(' / '),
      gloss: es.length === 1 ? es[0].sens.slice(0, 4).join(', ') : es.map((e) => `${pinyin(e.py)} : ${e.sens.slice(0, 3).join(', ')}`).join(' ; '),
      example: '', exampleGloss: ''
    });
  }
  if (!mots.length) { console.error('Aucun mot de la liste trouvé dans le dictionnaire : liste en caractères simplifiés ? fichier en UTF-8 ?'); process.exit(1); }
  await mkdir(path.dirname(fSortie), { recursive: true });
  await writeFile(fSortie, JSON.stringify({ version: 1, source: 'CFDICT, Chine Informations (https://chine.in), licence CC BY-SA 3.0', genere: new Date().toISOString(), mots }, null, 2));
  console.log(`${mots.length} mot(s) écrits dans ${fSortie}`);
  if (multiples.length) console.log(`${multiples.length} mot(s) à plusieurs lectures (regroupés sur une carte, à vérifier) :\n  ${multiples.join('\n  ')}`);
  if (absents.length) console.log(`${absents.length} mot(s) absents du dictionnaire (écartés) :\n  ${absents.join('\n  ')}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
