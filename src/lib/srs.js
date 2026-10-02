// Stockage local (IndexedDB) + répétition espacée SM-2. Un espace par langue via le champ « lang ».
let dbp;
const db = () => (dbp ??= new Promise((ok, ko) => {
  const r = indexedDB.open('polyglotte', 1);
  r.onupgradeneeded = () => {
    r.result.createObjectStore('cards', { keyPath: 'id' });
    r.result.createObjectStore('results', { autoIncrement: true });
    r.result.createObjectStore('productions', { autoIncrement: true });
  };
  r.onsuccess = () => ok(r.result);
  r.onerror = () => ko(r.error);
}));
const tx = async (store, mode, fn) => {
  const d = await db();
  return new Promise((ok, ko) => {
    const t = d.transaction(store, mode), req = fn(t.objectStore(store));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => ko(t.error);
  });
};
export const all = (s) => tx(s, 'readonly', (o) => o.getAll());
export const put = (s, v) => tx(s, 'readwrite', (o) => o.put(v));
export const add = (s, v) => tx(s, 'readwrite', (o) => o.add(v));

export function sm2(c, q) { // q : 1 raté, 3 difficile, 5 facile
  let { ef, reps, interval } = c;
  if (q < 3) { reps = 0; interval = 1; }
  else { reps++; interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef); }
  ef = Math.max(1.3, ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return { ...c, ef, reps, interval, seen: true, due: Date.now() + interval * 864e5 };
}
export async function ensureCards(lang, items) {
  const have = new Set((await all('cards')).map((c) => c.id));
  for (const it of items) if (!have.has(it.id)) await put('cards', { ...it, lang, ef: 2.5, reps: 0, interval: 0, due: 0, seen: false });
}
export async function dueCards(lang, idsSession, max = 10) { // révisions échues puis nouveautés de la session
  const cs = (await all('cards')).filter((c) => c.lang === lang), now = Date.now();
  const dues = cs.filter((c) => c.seen && c.due <= now).sort((a, b) => a.due - b.due).slice(0, max);
  return [...dues, ...cs.filter((c) => !c.seen && idsSession.includes(c.id))];
}
export const noter = (c, q) => put('cards', sm2(c, q));
export const recents = async (lang, n = 5) => (await all('results')).filter((r) => r.lang === lang).slice(-n);
// Lecture avec clés (les productions sont stockées avec des clés automatiques) et mise à jour par clé
export const avecCles = async (s) => {
  const d = await db();
  return new Promise((ok, ko) => {
    const out = [], r = d.transaction(s).objectStore(s).openCursor();
    r.onsuccess = () => { const c = r.result; if (c) { out.push({ key: c.key, ...c.value }); c.continue(); } else ok(out); };
    r.onerror = () => ko(r.error);
  });
};
export const majCle = (s, key, v) => tx(s, 'readwrite', (o) => o.put(v, key));

// Sauvegarde / restauration complète (cartes SRS, historique, productions). L'adresse du serveur n'y figure pas.
const vider = (s) => tx(s, 'readwrite', (o) => o.clear());
export async function exporterTout() {
  return { app: 'polyglotte', version: 1, date: new Date().toISOString(), cards: await all('cards'), results: await all('results'), productions: await all('productions'),
    lus: JSON.parse(localStorage.getItem('polyglotte.lu') ?? '[]') }; // lectures marquées « lues » (onglet Lecture)
}
export async function importerTout(d) {
  if (d?.app !== 'polyglotte' || d.version !== 1 || !['cards', 'results', 'productions'].every((k) => Array.isArray(d[k])))
    throw new Error('fichier non reconnu');
  if (!d.cards.every((c) => typeof c.id === 'string' && typeof c.lang === 'string')) throw new Error('cartes invalides');
  for (const s of ['cards', 'results', 'productions']) await vider(s); // seulement après validation complète
  for (const c of d.cards) await put('cards', c);
  for (const r of d.results) await add('results', r);
  for (const p of d.productions) await add('productions', p);
  if (Array.isArray(d.lus)) localStorage.setItem('polyglotte.lu', JSON.stringify(d.lus)); // anciennes sauvegardes sans « lus » : on ne touche à rien
  return { cards: d.cards.length, results: d.results.length, productions: d.productions.length, lus: d.lus?.length ?? 0 };
}
