// Lecture des lots générés par content-engine (public/batches/, précachés par le service worker).
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); };
export function idSemaine(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const n = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(n).padStart(2, '0')}`;
}
export async function chargerLot() {
  try { return { ...(await get(`./batches/${idSemaine(new Date())}.json`)), exact: true }; } catch { /* pas de lot cette semaine */ }
  try {
    const dernier = (await get('./batches/index.json')).batches.at(-1);
    if (dernier) return { ...(await get(`./batches/${dernier}.json`)), exact: false };
  } catch { /* aucun lot */ }
  return null;
}
export const sessionDuJour = (lot, jour, s) => lot?.sessions.find((x) => x.day === jour && x.slot === s.slot && x.lang === s.lang) ?? null;
// Niveau automatique : moyenne des 5 dernières sessions de la langue (≥ 85 % → exigeant, ≤ 55 % → facile)
export function choisirNiveau(session, resultats) {
  const dispo = Object.keys(session.tiers);
  const m = resultats.length ? resultats.reduce((t, r) => t + r.score, 0) / resultats.length : null;
  const voulu = m === null ? 'standard' : m >= 0.85 ? 'exigeant' : m <= 0.55 ? 'facile' : 'standard';
  return dispo.includes(voulu) ? voulu : dispo.includes('standard') ? 'standard' : dispo[0];
}
