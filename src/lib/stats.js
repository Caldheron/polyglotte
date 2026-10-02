// Indicateurs du tableau de bord, calculés à partir des données locales.
import { all } from './srs.js';
import { config } from './scheduler.js';

const JOUR = 864e5;
const cle = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const conseil = (n, moy) => n < 3 ? 'Pas assez de sessions pour juger (3 minimum).'
  : moy >= 0.85 ? 'Résultats très solides : tu pourrais alléger cette langue ou passer au niveau exigeant.'
  : moy <= 0.55 ? 'Résultats fragiles : envisage d’ajouter des minutes à cette langue.'
  : 'Rythme adapté.';

export async function calculer() {
  const [cards, results, prods] = await Promise.all([all('cards'), all('results'), all('productions')]);
  const now = Date.now(), jours = new Set(results.map((r) => cle(r.date)));
  let t = jours.has(cle(now)) ? now : now - JOUR, serie = 0;
  while (jours.has(cle(t))) { serie++; t -= JOUR; }
  const semaine = [0, 1, 2, 3, 4, 5, 6].filter((i) => jours.has(cle(now - i * JOUR))).length;
  const langues = Object.entries(config.langues).map(([id, l]) => {
    const c = cards.filter((x) => x.lang === id), rs = results.filter((r) => r.lang === id), r5 = rs.slice(-5);
    const moyenne = r5.length ? r5.reduce((s, r) => s + r.score, 0) / r5.length : null;
    const ev = prods.filter((p) => p.lang === id && p.feedback).sort((a, b) => b.date - a.date)[0];
    return { id, nom: l.nom, couleur: l.couleur, cartes: c.length, vues: c.filter((x) => x.seen).length,
      dues: c.filter((x) => x.seen && x.due <= now).length, mures: c.filter((x) => x.interval >= 21).length,
      sessions: rs.length, moyenne, niveau: ev?.feedback.niveau ?? null, conseil: conseil(rs.length, moyenne) };
  });
  return { serie, semaine, langues };
}
