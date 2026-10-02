<script>
  import { onMount } from 'svelte';
  import { ensureCards, dueCards, noter, add } from './lib/srs.js';
  import { parler, peutParler } from './lib/tts.js';

  let { session, tier, onfini } = $props();
  const blocs = session.tiers[tier].blocks;
  const vocab = blocs.find((b) => b.type === 'vocab')?.items ?? [];
  const lectures = blocs.filter((b) => b.type === 'reading');
  const prod = blocs.find((b) => b.type === 'production');
  const zh = session.lang === 'zh';

  let etape = $state('init'), file = $state([]), i = $state(0), montre = $state(false);
  let li = $state(0), rep = $state({}), py = $state(zh), fr = $state(false);
  let bonnes = $state(0), total = $state(0), texte = $state('');
  const carte = $derived(file[i]);

  onMount(async () => {
    await ensureCards(session.lang, vocab);
    file = await dueCards(session.lang, vocab.map((v) => v.id));
    etape = file.length ? 'vocab' : 'lecture';
  });
  async function noterCarte(q) {
    const c = file[i];
    if (!c.retry) { await noter(c, q); if (q < 3) file = [...file, { ...c, retry: true }]; } // une carte ratée revient en fin de séance
    montre = false;
    if (++i >= file.length) etape = 'lecture';
  }
  function repondre(k, q, j) { if (rep[k] !== undefined) return; rep[k] = j; total++; if (j === q.answer) bonnes++; }
  async function finir() {
    if (total) await add('results', { date: Date.now(), lang: session.lang, sessionId: session.id, tier, score: bonnes / total });
    etape = 'fin';
  }
  async function suite() {
    if (li + 1 < lectures.length) { li++; fr = false; return; }
    if (prod) etape = 'prod'; else await finir();
  }
  async function envoyer() {
    if (texte.trim()) await add('productions', { date: Date.now(), lang: session.lang, sessionId: session.id, tier, prompt: prod.prompt, texte, evalue: false });
    await finir();
  }
  const titre = { init: '…', vocab: 'Vocabulaire', lecture: 'Lecture', prod: 'Production', fin: 'Terminé' };
</script>

<header class="plaque">
  <h1>{titre[etape]}</h1>
  <p>{session.lang.toUpperCase()} · niveau {tier}{session.theme ? ` · ${session.theme}` : ''}</p>
</header>

{#if etape === 'vocab' && carte}
  <div class="bloc">
    <p class="mute">{i + 1} / {file.length}{carte.retry ? ' · à revoir' : ''}</p>
    <div class="terme">{carte.term}</div>
    {#if peutParler()}<button class="mini" onclick={() => parler(carte.term, session.lang)} aria-label="Écouter">🔊</button>{/if}
    {#if montre}
      {#if zh}<div class="mute">{carte.pinyin}</div>{/if}
      <div class="gloss">{carte.gloss}</div>
      <p class="ex">{carte.example}<br /><span class="mute">{carte.exampleGloss}</span></p>
      <div class="notes">
        <button onclick={() => noterCarte(1)}>Raté</button>
        <button onclick={() => noterCarte(3)}>Difficile</button>
        <button onclick={() => noterCarte(5)}>Facile</button>
      </div>
    {:else}
      <button class="go" onclick={() => (montre = true)}>Voir la réponse</button>
    {/if}
  </div>
{:else if etape === 'lecture'}
  {@const l = lectures[li]}
  <div class="bloc">
    <p class="mute">Passage {li + 1} / {lectures.length} · {l.title}</p>
    <div class="outils">
      {#if zh}<button class="mini" class:on={py} onclick={() => (py = !py)}>pinyin</button>{/if}
      <button class="mini" class:on={fr} onclick={() => (fr = !fr)}>traduction</button>
      {#if peutParler()}<button class="mini" onclick={() => parler(l.sentences.map((s) => s.t).join(zh ? '' : ' '), session.lang)}>🔊 tout</button>{/if}
    </div>
    {#each l.sentences as s}
      <p class="phrase"><span>{s.t}</span>
        {#if peutParler()}<button class="mini" onclick={() => parler(s.t, session.lang)} aria-label="Écouter">🔊</button>{/if}
        {#if py && s.py}<br /><span class="mute">{s.py}</span>{/if}
        {#if fr}<br /><span class="mute">{s.fr}</span>{/if}</p>
    {/each}
    {#each l.questions as q, qi}
      {@const k = `${li}-${qi}`}
      <div class="quest"><strong>{q.q}</strong>
        {#each q.choices as c, j}
          <button class="choix" class:ok={rep[k] !== undefined && j === q.answer} class:ko={rep[k] === j && j !== q.answer}
            disabled={rep[k] !== undefined} onclick={() => repondre(k, q, j)}>{c}</button>
        {/each}
        {#if rep[k] !== undefined}<p class="mute">{q.explain}</p>{/if}
      </div>
    {/each}
    <button class="go" onclick={suite}>{li + 1 < lectures.length ? 'Passage suivant' : 'Continuer'}</button>
  </div>
{:else if etape === 'prod'}
  <div class="bloc">
    <p>{prod.prompt}</p>
    <textarea rows="6" bind:value={texte} placeholder="Écris ici…"></textarea>
    <button class="go" onclick={envoyer}>Enregistrer et terminer</button>
    <button class="mini" onclick={finir}>Passer</button>
  </div>
{:else if etape === 'fin'}
  <div class="bloc">
    <p>{total ? `Questions : ${bonnes} / ${total}` : 'Session terminée.'}</p>
    <p class="mute">Ta production sera évaluée quand l'étape 4 sera en place.</p>
    <button class="go" onclick={onfini}>Retour</button>
  </div>
{/if}

<style>
  .plaque { background:var(--plaque); border-radius:4px; border-bottom:4px solid var(--ink); padding:.9rem 1rem; margin:.5rem 0 .4rem; }
  h1 { font-size:1.9rem; font-weight:500; line-height:1.1; margin:0; }
  .plaque p { margin:.15rem 0 0; color:var(--mute); font-size:.85rem; }
  .bloc > .mini { justify-self:start; }
  .bloc { background:var(--card); border-radius:6px; padding:1rem; margin-top:.8rem; display:grid; gap:.6rem; }
  .mute { color:var(--mute); font-size:.85rem; margin:0; }
  .terme { font-size:2.2rem; font-weight:500; line-height:1.15; }
  .gloss { font-size:1.2rem; }
  .ex { margin:0; }
  .phrase { margin:0; font-size:1.15rem; }
  .outils, .notes { display:flex; gap:.5rem; flex-wrap:wrap; }
  button { font:inherit; color:var(--ink); }
  .go, .notes button { border:0; border-radius:3px; background:var(--ink); color:#1F2326; padding:.65rem 1rem; font-size:.95rem; }
  .notes button { flex:1; }
  .mini { border:1px solid var(--line); background:none; border-radius:3px; padding:.2rem .55rem; font-size:.8rem; }
  .mini.on { background:var(--ink); color:#1F2326; }
  .quest { display:grid; gap:.4rem; margin-top:.5rem; }
  .choix { text-align:left; border:1px solid var(--line); background:none; border-radius:3px; padding:.55rem .7rem; }
  .choix.ok { border-color:#6FBF8F; } .choix.ko { border-color:#D9726F; }
  textarea { background:var(--bg); color:var(--ink); border:1px solid var(--line); border-radius:3px; padding:.6rem; font:inherit; }
</style>
