// eval-engine : envoie les productions en attente à Qwen (Ollama via Tailscale) et enregistre le feedback.
// L'adresse du serveur reste sur le téléphone (localStorage) : elle n'est jamais dans le code public.
import { avecCles, majCle } from './srs.js';

const LS = 'polyglotte.eval';
const DEFAUT = { url: '', model: 'qwen3:8b' };
export const lireReglages = () => { try { return { ...DEFAUT, ...JSON.parse(localStorage.getItem(LS)) }; } catch { return { ...DEFAUT }; } };
export const sauverReglages = (r) => localStorage.setItem(LS, JSON.stringify(r));
const base = (u) => u.trim().replace(/\/+$/, '');
const LANGUE = { es: 'espagnol', zh: 'chinois', ja: 'japonais' };
const S = { type: 'string' };
const FORMAT = {
  type: 'object',
  properties: {
    niveau: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2'] },
    note: { type: 'integer' },
    erreurs: { type: 'array', items: { type: 'object', properties: { original: S, correction: S, explication: S }, required: ['original', 'correction', 'explication'] } },
    points_forts: { type: 'array', items: S },
    conseil: S
  },
  required: ['niveau', 'note', 'erreurs', 'points_forts', 'conseil']
};

export async function tester(r) { // renvoie la liste des modèles disponibles
  const res = await fetch(`${base(r.url)}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`réponse ${res.status}`);
  return (await res.json()).models.map((m) => m.name);
}

async function evaluerUne(r, p) {
  const l = LANGUE[p.lang] ?? p.lang;
  const corps = (think) => JSON.stringify({
    model: r.model, stream: false, ...(think ? { think: false } : {}), format: FORMAT, options: { temperature: 0.2, num_ctx: 8192 },
    messages: [
      { role: 'system', content: `Tu es un professeur de ${l} bienveillant et rigoureux. Tu évalues le texte d'un élève francophone. Réponds uniquement en JSON.` },
      { role: 'user', content: `Consigne donnée à l'élève : ${p.prompt}\n\nTexte de l'élève (${l}) :\n${p.texte}\n\nÉvalue ce texte : niveau CECRL estimé (A1, A2, B1 ou B2), note de 0 à 10 par rapport à la consigne, erreurs réelles (original = extrait fautif, correction, explication courte en français), 1 à 3 points forts (en français), un conseil pour la suite (en français). Si le texte est correct, erreurs = [].` }
    ]
  });
  const post = (think) => fetch(`${base(r.url)}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps(think), signal: AbortSignal.timeout(300000) });
  let res = await post(true);
  if (res.status === 400 && /think/i.test(await res.clone().text())) res = await post(false);
  if (!res.ok) throw new Error(`réponse ${res.status}`);
  return JSON.parse((await res.json()).message.content);
}

export async function evaluerEnAttente(r) { // → { n, erreur } : n productions évaluées, erreur éventuelle qui a interrompu le lot
  let n = 0;
  for (const { key, ...p } of (await avecCles('productions')).filter((x) => !x.evalue)) {
    try {
      const fb = await evaluerUne(r, p);
      await majCle('productions', key, { ...p, evalue: true, feedback: { ...fb, model: r.model, date: Date.now() } });
      n++;
    } catch (e) { return { n, erreur: e.message }; }
  }
  return { n };
}

export async function evaluerSiJoignable() { // appelé à l'ouverture de l'app : silencieux si Tailscale est coupé
  const r = lireReglages();
  if (!r.url) return null;
  try { await tester(r); } catch { return null; }
  return evaluerEnAttente(r);
}
