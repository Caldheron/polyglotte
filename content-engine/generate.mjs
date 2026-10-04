#!/usr/bin/env node
// content-engine : génère les batchs d'exercices de Polyglotte avec Qwen (Ollama), sur le PC.
// Aucune dépendance : Node 18+ suffit.
//
// Exemples :
//   node content-engine/generate.mjs --session es-mar-aller --semaine 2026-W41
//   node content-engine/generate.mjs --semaine 2026-W41 --semaines 4        (une tranche de 4 semaines)
//   options : --tier facile|standard|exigeant   --no-review   --souple (longueur hors norme = simple avertissement)   --debug   --review-model <nom>   --sortie <dossier>   --ollama <url>   --model <nom>

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const lireJSON = async (p) => JSON.parse(await readFile(p, 'utf8'));
const log = (...a) => console.log(...a);

// ---------- arguments ----------
const args = process.argv.slice(2);
const opt = (nom, def) => { const i = args.indexOf(`--${nom}`); return i >= 0 ? args[i + 1] : def; };
const flag = (nom) => args.includes(`--${nom}`);

// ---------- semaines ISO ("2026-W41") ----------
function lundiDe(id) {
  const m = /^(\d{4})-W(\d{2})$/.exec(id);
  if (!m) throw new Error(`Semaine invalide : "${id}" (attendu : 2026-W41)`);
  const quatre = new Date(Date.UTC(+m[1], 0, 4)); // le 4 janvier est toujours en semaine 1
  const lundi = new Date(quatre);
  lundi.setUTCDate(quatre.getUTCDate() - ((quatre.getUTCDay() + 6) % 7) + (+m[2] - 1) * 7);
  return lundi;
}
function idSemaine(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const n = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(n).padStart(2, '0')}`;
}
function semaineSuivante(id) { const d = lundiDe(id); d.setUTCDate(d.getUTCDate() + 7); return idSemaine(d); }

// ---------- catalogue des sessions (dérivé du scheduler) ----------
const JOURS = { lundi: 'lun', mardi: 'mar', mercredi: 'mer', jeudi: 'jeu', vendredi: 'ven', samedi: 'sam', dimanche: 'dim' };
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function catalogue(planning, cfg) {
  const out = [];
  for (const [jour, slots] of Object.entries(planning.semaine))
    for (const s of slots)
      if (cfg.langues[s.lang]) out.push({ id: `${s.lang}-${JOURS[jour]}-${slug(s.slot)}`, jour, ...s }); // ja : pas encore généré
  return out;
}

// ---------- schéma JSON imposé à Ollama ----------
const S = { type: 'string' };
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
function schemaPour(recette, lang) {
  const zh = lang === 'zh';
  const vocabItem = obj({ term: S, gloss: S, example: S, exampleGloss: S, ...(zh ? { pinyin: S } : {}) });
  const phrase = obj({ t: S, fr: S, ...(zh ? { py: S } : {}) });
  const question = obj({ q: S, choices: { type: 'array', items: S }, answer: { type: 'integer' }, explain: S });
  const props = {
    vocab: { type: 'array', items: vocabItem },
    reading: obj({ title: S, sentences: { type: 'array', items: phrase }, questions: { type: 'array', items: question } })
  };
  if (recette.production) props.production = obj({ prompt: S });
  return obj(props);
}
const SCHEMA_REVIEW = obj({ issues: { type: 'array', items: obj({ where: S, problem: S, fix: S }) } });

// ---------- prompts ----------
const SYSTEME = "Tu es un professeur de langues rigoureux. Tu produis uniquement du JSON conforme au schéma demandé, sans texte autour. Ta priorité est l'exactitude de la langue cible.";

function promptUtilisateur({ cfg, lang, recette, tier, dejaVus, theme, total = 1 }) {
  const L = cfg.langues[lang], r = recette.reading, zh = lang === 'zh';
  const [mn, mx] = r.longueur, ph = r.phrases ?? [10, 14], lp = r.longueurPhrase ?? [10, 15];
  const unite = zh ? 'caractères chinois' : 'mots';
  return [
    `Langue cible : ${L.nom}.`,
    `Élève : francophone (parle aussi anglais). ${L.niveau}`,
    `Difficulté demandée : ${tier} — ${cfg.tiers[tier]}`,
    L.consignes,
    theme ? `Thème imposé : ${theme}. Le texte ET tout le vocabulaire portent sur ce thème, sans en sortir.` : '',
    total > 1 ? `Cette séance comporte ${total} passages de lecture : écris ici le passage 1 sur ${total} (courte mise en situation du thème).` : '',
    '',
    "Produis une séance d'entraînement contenant :",
    `1. "vocab" : exactement ${recette.vocab} éléments de vocabulaire utiles et fréquents, utiles pour ce thème. Pour chacun : term (dans la langue cible), gloss (traduction française), example (phrase d'exemple courte dans la langue cible), exampleGloss (sa traduction française)${zh ? ', pinyin (avec tons)' : ''}.`,
    `2. "reading" : ${r.forme === 'dialogue' ? 'un dialogue' : 'un texte'} de ${mn} à ${mx} ${unite} AU TOTAL, soit ${ph[0]} à ${ph[1]} ${r.forme === 'dialogue' ? 'répliques' : 'phrases'} de ${lp[0]} à ${lp[1]} ${unite} chacune (une entrée de "sentences" par ${r.forme === 'dialogue' ? 'réplique' : 'phrase'} : t = texte en langue cible, fr = traduction française${zh ? ', py = pinyin avec tons' : ''}). Un texte plus court sera rejeté : compte tes phrases. Cette longueur reste la même quel que soit le niveau de difficulté. Ajoute un titre (title), puis ${r.questions} questions de compréhension en ${L.questionsEn} (q ; choices = 4 propositions ; answer = index de la bonne réponse, en partant de 0 ; explain = courte explication en français). Réutilise plusieurs mots du vocabulaire dans le texte.`,
    recette.production ? `3. "production" : une consigne (prompt), en français, demandant d'écrire 2 à 3 phrases en ${L.nom} sur le thème du texte.` : '',
    dejaVus.length ? `\nNe reprends PAS ces termes déjà travaillés : ${dejaVus.join(', ')}.` : '',
    '\nRéponds uniquement avec le JSON demandé.'
  ].join('\n');
}

// ---------- appel Ollama ----------
async function appelOllama(cfg, messages, format, temperature, model = cfg.model) {
  const requete = (avecThink) => fetch(`${cfg.ollama}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, ...(avecThink ? { think: false } : {}), format, options: { temperature, num_ctx: 8192 } }),
    signal: AbortSignal.timeout(cfg.timeoutMs)
  });
  let r;
  try {
    r = await requete(true);
    // certains modèles (mistral…) refusent le paramètre « think » : on réessaie sans
    if (r.status === 400 && /think/i.test(await r.clone().text())) r = await requete(false);
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error('délai dépassé');
    const err = new Error(`Ollama injoignable sur ${cfg.ollama} (${e.cause?.code ?? e.message}). Ollama est-il lancé ?`);
    err.fatal = true;
    throw err;
  }
  if (!r.ok) throw new Error(`Ollama a répondu ${r.status} : ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return JSON.parse(j.message.content);
}

// ---------- filtre du bruit de la relecture ----------
// NFC : un même pinyin accentué peut être écrit en une ou en plusieurs unités Unicode ; on conserve les accents (un ton faux reste une vraie erreur)
const normaliser = (x) => String(x ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
const valeurA = (obj, chemin) => String(chemin).split(/[.\[\]]+/).filter(Boolean).reduce((o, k) => o?.[k], obj);
function filtrerReview(issues, vue) {
  return issues.filter((i) => {
    const cur = valeurA(vue, i.where), fix = String(i.fix ?? '');
    if (!i.problem?.trim()) return false;
    if (/pas de correction|aucune correction|pas d'erreur|no correction/i.test(`${i.problem} ${fix}`)) return false;
    if (typeof cur === 'string' && normaliser(cur) === normaliser(fix)) return false; // « correction » identique au texte
    if (typeof cur === 'number' && fix.match(/\d+/)?.[0] === String(cur)) return false; // index de réponse déjà bon
    return true;
  });
}

// ---------- validation (la forme est garantie par le schéma ; on vérifie le fond) ----------
const HAN = /\p{Script=Han}/u;
const bigrammes = (t) => { const c = [...t].filter((x) => HAN.test(x)); return new Set(c.slice(0, -1).map((x, i) => x + c[i + 1])); };
const similarite = (a, b) => { const A = bigrammes(a), B = bigrammes(b); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.min(A.size, B.size); };
const partHan = (t) => { const c = [...String(t ?? '')].filter((x) => !/\s/.test(x)); return c.length ? c.filter((x) => HAN.test(x)).length / c.length : 0; };
function valider(d, recette, lang, souple = false, sansVocab = false, avant = []) {
  const e = [], av = [], zh = lang === 'zh', rd = d.reading, [mn, mx] = recette.reading.longueur;
  const v = d.vocab;
  if (sansVocab) { /* passage suivant : pas de vocabulaire */ } else if (!Array.isArray(v) || Math.abs(v.length - recette.vocab) > 2) e.push(`vocab : ${recette.vocab} éléments attendus, reçu ${v?.length ?? 0}`);
  else v.forEach((x, i) => {
    if (![x.term, x.gloss, x.example, x.exampleGloss].every((s) => s?.trim())) e.push(`vocab[${i}] incomplet`);
    if (zh && !HAN.test(x.term ?? '')) e.push(`vocab[${i}] : le terme doit être en caractères chinois`);
    if (zh && !x.pinyin?.trim()) e.push(`vocab[${i}] : pinyin manquant`);
    if (zh && /\d/.test(x.pinyin ?? '')) e.push(`vocab[${i}] : chiffre dans le pinyin (écrire les tons en diacritiques)`);
    if (zh && partHan(x.gloss) > 0.3) e.push(`vocab[${i}] : la traduction doit être en français`);
    if (!zh && HAN.test(x.term ?? '')) e.push(`vocab[${i}] : le terme doit être en ${lang}`);
  });
  if (!rd?.sentences?.length) return { erreurs: [...e, 'reading : aucune phrase'], avert: av };
  rd.sentences.forEach((s, i) => {
    if (!s.t?.trim() || !s.fr?.trim()) e.push(`phrase ${i} incomplète`);
    if (zh && (!HAN.test(s.t ?? '') || !s.py?.trim())) e.push(`phrase ${i} : caractères ou pinyin manquants`);
    if (!zh && HAN.test(s.t ?? '')) e.push(`phrase ${i} : caractères chinois inattendus`);
  });
  const texte = rd.sentences.map((s) => s.t).join(zh ? '' : ' ');
  if (zh) { // garde-fous sur les défauts observés le 02/10 : chiffres dans le pinyin, français manquant, passages quasi identiques
    rd.sentences.forEach((s, i) => {
      if (/\d/.test(s.py ?? '')) e.push(`phrase ${i} : chiffre dans le pinyin (écrire les nombres en lettres pinyin)`);
      if (HAN.test(s.py ?? '')) e.push(`phrase ${i} : le pinyin ne doit contenir aucun caractère chinois`);
      if (partHan(s.fr) > 0.3) e.push(`phrase ${i} : la traduction doit être en français`);
    });
    (rd.questions ?? []).forEach((q, i) => { if (partHan(q.q) > 0.3 || partHan(q.explain) > 0.3) e.push(`question ${i} : question et explication doivent être en français`); });
    avant.forEach((p, k) => {
      if (similarite(texte, p.sentences.map((x) => x.t).join('')) > 0.5) e.push(`reading trop semblable au passage ${k + 1} : change de situation, de personnages et de phrases`);
    });
  }
  const taille = zh ? [...texte].filter((c) => HAN.test(c)).length : texte.split(/\s+/).filter(Boolean).length;
  if (taille < mn * 0.7 || taille > mx * 1.3)
    (souple ? av : e).push(`reading trop ${taille < mn ? 'court' : 'long'} : ${taille} ${zh ? 'caractères' : 'mots'} (${rd.sentences.length} phrases), ${mn} à ${mx} attendus`);
  const qs = rd.questions ?? [];
  if (Math.abs(qs.length - recette.reading.questions) > 1) e.push(`${recette.reading.questions} questions attendues, reçu ${qs.length}`);
  qs.forEach((q, i) => {
    if (!q.q?.trim() || !Array.isArray(q.choices) || q.choices.length < 3) e.push(`question ${i} : au moins 3 choix requis`);
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) e.push(`question ${i} : index de réponse invalide`);
  });
  if (recette.production && !sansVocab && !d.production?.prompt?.trim()) e.push('production : consigne manquante');
  return { erreurs: e, avert: av };
}

// ---------- assemblage ----------
const idMot = (lang, terme) => `${lang}-${createHash('sha1').update(terme.trim().toLowerCase()).digest('hex').slice(0, 8)}`;
function melanger(q) { // les modèles placent souvent la bonne réponse en premier : on mélange
  const idx = q.choices.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { ...q, choices: idx.map((i) => q.choices[i]), answer: idx.indexOf(q.answer) };
}
function assembler(d, lang, recette) {
  const blocks = [{ type: 'vocab', items: d.vocab.map((x) => ({ id: idMot(lang, x.term), ...x })) }];
  for (const r of d.readings ?? [d.reading])
    blocks.push({ type: 'reading', title: r.title, sentences: r.sentences, questions: r.questions.map(melanger) });
  if (recette.production) blocks.push({ type: 'production', kind: 'written', prompt: d.production.prompt });
  return blocks;
}

// ---------- génération d'un niveau de difficulté ----------
async function avecReessais(cfg, base, schema, verifier) {
  let erreurs = [];
  for (let n = 1; n <= cfg.tentatives; n++) {
    const contenu = erreurs.length ? `${base}\n\nTa tentative précédente était invalide :\n- ${erreurs.join('\n- ')}\nCorrige ces points.` : base;
    let data;
    try {
      data = await appelOllama(cfg, [{ role: 'system', content: SYSTEME }, { role: 'user', content: contenu }], schema, 0.7);
    } catch (e) {
      if (e.fatal) throw e;
      erreurs = [`réponse inutilisable (${e.message})`];
      log(`    tentative ${n}/${cfg.tentatives} : ${erreurs[0]}`);
      continue;
    }
    const v = verifier(data);
    erreurs = v.erreurs;
    if (!erreurs.length) return { data, avert: v.avert };
    log(`    tentative ${n}/${cfg.tentatives} invalide : ${erreurs.slice(0, 3).join(' ; ')}`);
    if (flag('debug')) log(`    [debug] ${JSON.stringify(data.reading?.sentences?.map((x) => x.t) ?? data).slice(0, 700)}`);
  }
  throw new Error(`échec après ${cfg.tentatives} tentatives (${erreurs[0]})`);
}

function promptPassage({ cfg, lang, recette, tier, theme, n, total, termes, titres }) {
  const L = cfg.langues[lang], r = recette.reading, zh = lang === 'zh', unite = zh ? 'caractères chinois' : 'mots';
  const [mn, mx] = r.longueur, ph = r.phrases ?? [4, 8], lp = r.longueurPhrase ?? [5, 10];
  return [
    `Langue cible : ${L.nom}.`,
    `Élève : francophone (parle aussi anglais). ${L.niveau}`,
    `Difficulté demandée : ${tier} — ${cfg.tiers[tier]}`,
    L.consignes,
    `Thème : ${theme ?? 'libre'}. C'est le passage ${n} sur ${total} d'une même séance : même thème, mais une autre situation que les passages précédents (titres déjà pris : ${titres.join(' ; ')}).`,
    '',
    `Produis "reading" : un texte de ${mn} à ${mx} ${unite} AU TOTAL, soit ${ph[0]} à ${ph[1]} phrases de ${lp[0]} à ${lp[1]} ${unite} chacune (une entrée de "sentences" par phrase : t = texte en langue cible, fr = traduction française${zh ? ', py = pinyin avec tons' : ''}). Un texte plus court sera rejeté : compte tes phrases. Ajoute un titre (title), puis ${r.questions} questions de compréhension en ${L.questionsEn} (q ; choices = 4 propositions ; answer = index de la bonne réponse, en partant de 0 ; explain = courte explication en français). Réutilise si possible ces mots : ${termes.join(', ')}.`,
    '\nRéponds uniquement avec le JSON demandé.'
  ].join('\n');
}

async function genererTier({ cfg, lang, recette, tier, dejaVus, review, theme }) {
  const total = recette.passages ?? 1, souple = flag('souple');
  const premier = await avecReessais(cfg, promptUtilisateur({ cfg, lang, recette, tier, dejaVus, theme, total }), schemaPour(recette, lang),
    (d) => valider(d, recette, lang, souple));
  const data = premier.data, avert = [...premier.avert];
  data.readings = [data.reading];
  for (let n = 2; n <= total; n++) {
    const p = await avecReessais(cfg,
      promptPassage({ cfg, lang, recette, tier, theme, n, total, termes: data.vocab.map((x) => x.term), titres: data.readings.map((r) => r.title) }),
      obj({ reading: schemaPour(recette, lang).properties.reading }),
      (d) => valider(d, recette, lang, souple, true, data.readings));
    data.readings.push(p.data.reading);
    avert.push(...p.avert);
  }
  const sortie = { blocks: assembler(data, lang, recette), reviewed: false };
  if (avert.length) sortie.warnings = avert;
  if (review) {
    // la relecture porte sur la version finale (réponses déjà mélangées) : les chemins signalés correspondent au fichier
    const vue = { vocab: sortie.blocks[0].items.map(({ id, ...x }) => x), readings: sortie.blocks.filter((b) => b.type === 'reading').map(({ type, ...x }) => x) };
    try {
      const rv = await appelOllama(cfg, [
        { role: 'system', content: SYSTEME },
        { role: 'user', content: `Relis ce contenu d'exercices en ${cfg.langues[lang].nom}. Signale UNIQUEMENT les erreurs certaines : grammaire, vocabulaire, traduction fausse${lang === 'zh' ? ', pinyin faux' : ''}, réponse de question incorrecte. Pour chaque erreur : where = chemin précis (ex. readings[0].questions[2].choices[1]), problem = description du problème en une phrase, rédigée en FRANÇAIS, fix = correction proposée. S'il n'y en a aucune, renvoie issues = [].\n\n${JSON.stringify(vue)}` }
      ], SCHEMA_REVIEW, 0, cfg.reviewModel ?? cfg.model);
      const brut = rv.issues ?? [], gardees = filtrerReview(brut, vue);
      sortie.review = { by: cfg.reviewModel ?? cfg.model, issues: gardees, filtered: brut.length - gardees.length };
    } catch (e) { if (e.fatal) throw e; sortie.review = { by: cfg.reviewModel ?? cfg.model, error: e.message }; }
  }
  return sortie;
}

// ---------- fichiers de sortie ----------
async function termesConnus(dossier) {
  const m = {};
  let fichiers = [];
  try { fichiers = (await readdir(dossier)).filter((f) => /^\d{4}-W\d{2}\.json$/.test(f)).sort(); } catch { /* dossier absent */ }
  for (const f of fichiers) {
    const b = await lireJSON(path.join(dossier, f));
    for (const s of b.sessions) for (const t of Object.values(s.tiers)) for (const bl of t.blocks)
      if (bl.type === 'vocab') for (const it of bl.items) (m[s.lang] ??= new Set()).add(it.term);
  }
  return m;
}
async function sauver(dossier, idSem, cfg, session) {
  await mkdir(dossier, { recursive: true });
  const f = path.join(dossier, `${idSem}.json`);
  let b;
  try { b = await lireJSON(f); } catch { b = { schema: 1, batchId: idSem, model: cfg.model, sessions: [] }; }
  b.generatedAt = new Date().toISOString();
  const i = b.sessions.findIndex((s) => s.id === session.id);
  if (i >= 0) b.sessions[i] = session; else b.sessions.push(session);
  await writeFile(f, JSON.stringify(b, null, 2));
  const ids = (await readdir(dossier)).filter((x) => /^\d{4}-W\d{2}\.json$/.test(x)).map((x) => x.slice(0, -5)).sort();
  await writeFile(path.join(dossier, 'index.json'), JSON.stringify({ schema: 1, batches: ids }, null, 2));
}

// ---------- programme principal ----------
const cfg = await lireJSON(path.join(ICI, 'config.json'));
if (opt('ollama')) cfg.ollama = opt('ollama');
if (opt('model')) cfg.model = opt('model');
if (opt('review-model')) cfg.reviewModel = opt('review-model');
const dossier = path.resolve(RACINE, opt('sortie', cfg.sortie));
const planning = await lireJSON(path.join(RACINE, 'src/scheduler/config.json'));
const toutes = catalogue(planning, cfg);
const choix = opt('session');
const sessions = choix ? toutes.filter((s) => s.id === choix) : toutes;
if (!sessions.length) { console.error(`Session inconnue "${choix}". Disponibles : ${toutes.map((s) => s.id).join(', ')}`); process.exit(2); }
const semainesDepuis = (id) => Math.round((lundiDe(id) - lundiDe('2026-W01')) / (7 * 864e5));
function themeDe(s, semaine) { // déterministe : deux sessions d'une même langue n'ont jamais le même thème de suite
  const liste = cfg.themes?.[s.lang];
  if (!liste?.length) return null;
  const memes = toutes.filter((x) => x.lang === s.lang);
  return liste[(semainesDepuis(semaine) * memes.length + memes.findIndex((x) => x.id === s.id)) % liste.length];
}
const t00 = Date.now();
const tiers = opt('tier') ? [opt('tier')] : Object.keys(cfg.tiers);
if (tiers.some((t) => !cfg.tiers[t])) { console.error(`Niveau inconnu. Choix : ${Object.keys(cfg.tiers).join(', ')}`); process.exit(2); }

let semaine = opt('semaine') ?? idSemaine(new Date(Date.now() + 7 * 864e5));
const nbSemaines = Number(opt('semaines', '1'));
const connus = await termesConnus(dossier);
let echecs = 0;

for (let w = 0; w < nbSemaines; w++, semaine = semaineSuivante(semaine)) {
  log(`\n=== ${semaine} ===`);
  for (const s of sessions) {
    const recette = cfg.recettes[`${s.lang}:${s.type}`];
    if (!recette) { log(`${s.id} : pas de recette pour "${s.lang}:${s.type}", ignorée`); continue; }
    const theme = themeDe(s, semaine);
    const session = { id: s.id, day: s.jour, slot: s.slot, lang: s.lang, minutes: s.minutes, type: s.type, theme, tiers: {} };
    for (const tier of tiers) {
      const t0 = Date.now();
      log(`${s.id} [${tier}]${theme ? ` — thème : ${theme}` : ''} …`);
      try {
        const dejaVus = [...(connus[s.lang] ?? [])].slice(-60);
        session.tiers[tier] = await genererTier({ cfg, lang: s.lang, recette, tier, dejaVus, review: !flag('no-review'), theme });
        for (const bl of session.tiers[tier].blocks) if (bl.type === 'vocab') for (const it of bl.items) (connus[s.lang] ??= new Set()).add(it.term);
        (session.tiers[tier].warnings ?? []).forEach((w) => log(`      ! ${w}`));
        const issues = session.tiers[tier].review?.issues ?? [];
        log(`    ok en ${Math.round((Date.now() - t0) / 1000)} s${issues.length ? ` — ${issues.length} point(s) signalé(s) à la relecture` : ''}${session.tiers[tier].review?.filtered ? ` (${session.tiers[tier].review.filtered} alerte(s) sans valeur écartée(s))` : ''}`);
        issues.forEach((i) => log(`      · ${i.where} : ${i.problem}${i.fix ? ` → ${i.fix}` : ''}`));
      } catch (e) {
        if (e.fatal) { console.error(`\n${e.message}`); process.exit(1); }
        echecs++;
        log(`    ÉCHEC : ${e.message}`);
      }
    }
    if (Object.keys(session.tiers).length) await sauver(dossier, semaine, cfg, session);
  }
}
const dt = Math.round((Date.now() - t00) / 1000);
log(`\nTerminé en ${Math.floor(dt / 60)} min ${dt % 60} s. Sortie : ${dossier}${echecs ? ` — ${echecs} niveau(x) en échec` : ''}`);
process.exit(echecs ? 1 : 0);
