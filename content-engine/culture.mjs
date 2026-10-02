#!/usr/bin/env node
// Construit public/culture.json : pour chaque sujet (titre d'article Wikipédia français), retrouve l'article
// équivalent dans la langue cible via l'API de Wikipédia (liens interlangues). Les liens sont donc vérifiés,
// rien n'est inventé ni généré par un modèle. Un sujet sans équivalent ou introuvable est écarté et signalé.
// Usage : node content-engine/culture.mjs        (option de test : --api <url>)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const api = args.includes('--api') ? args[args.indexOf('--api') + 1] : 'https://fr.wikipedia.org/w/api.php';
const url = (lang, t) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;

async function resoudre(s) {
  const q = `${api}?action=query&format=json&formatversion=2&redirects=1&prop=langlinks&lllimit=50&lllang=${s.langue}&titles=${encodeURIComponent(s.fr)}`;
  const r = await fetch(q, { headers: { 'User-Agent': 'Polyglotte-PWA/1.0 (apprentissage personnel)' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const page = (await r.json()).query?.pages?.[0];
  if (!page || page.missing) return { erreur: 'article français introuvable' };
  const ll = page.langlinks?.[0];
  if (!ll) return { erreur: `pas d'équivalent en ${s.langue}` };
  return { titre: page.title, fr: url('fr', page.title), cible: url(s.langue, ll.title), titreCible: ll.title };
}

const sujets = JSON.parse(await readFile(path.join(ICI, 'culture-sujets.json'), 'utf8')), ok = [], ecartes = [];
for (const s of sujets) {
  try {
    const r = await resoudre(s);
    if (r.erreur) { ecartes.push(`${s.id} : ${r.erreur}`); continue; }
    ok.push({ id: s.id, langue: s.langue, theme: s.theme, ...r });
  } catch (e) {
    console.error(`Wikipédia injoignable ou refus (${e.message}). Connexion Internet active ?`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 250)); // on ménage le serveur
}
const sortie = path.join(ICI, '..', 'public', 'culture.json');
await mkdir(path.dirname(sortie), { recursive: true });
await writeFile(sortie, JSON.stringify({ version: 1, genere: new Date().toISOString(), source: 'Wikipédia', sujets: ok }, null, 2));
console.log(`${ok.length} sujet(s) écrits dans ${sortie}`);
if (ecartes.length) console.log(`${ecartes.length} écarté(s) :\n  ${ecartes.join('\n  ')}`);
