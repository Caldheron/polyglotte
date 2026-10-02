<script>
  import { noter, add } from './lib/srs.js';
  import { parler, peutParler } from './lib/tts.js';
  let { lang, cartes, libre, onfini, enregistrer = null } = $props(); // libre : sans effet sur le planning ; enregistrer : id de session pour le bilan
  let total = 0, rates = 0;
  let file = $state([...cartes]), i = $state(0), montre = $state(false);
  const carte = $derived(file[i]);
  async function reponse(q) {
    const c = file[i];
    if (!c.retry) { total++; if (q < 3) rates++; if (!libre) await noter(c, q); if (q < 3) file = [...file, { ...c, retry: true }]; }
    montre = false; i++;
    if (i >= file.length && enregistrer && !libre) await add('results', { date: Date.now(), lang, sessionId: enregistrer, tier: 'cartes', score: 1 - rates / Math.max(1, total) });
  }
</script>

<header class="plaque"><h1>Révision</h1><p>{lang.toUpperCase()} · {libre ? 'entraînement libre (le planning ne change pas)' : 'cartes à réviser'}</p></header>
<div class="bloc">
  {#if carte}
    <p class="mute">{i + 1} / {file.length}{carte.retry ? ' · à revoir' : ''}</p>
    <div class="terme">{carte.term}</div>
    {#if peutParler() && lang !== 'ja'}<button class="mini" onclick={() => parler(carte.term, lang)} aria-label="Écouter">🔊</button>{/if}
    {#if montre}
      {#if carte.pinyin || carte.lecture}<div class="mute">{carte.pinyin ?? carte.lecture}</div>{/if}
      <div class="gloss">{carte.gloss}</div>
      {#if carte.example}<p class="ex">{carte.example}<br /><span class="mute">{carte.exampleGloss}</span></p>{/if}
      <div class="notes">
        <button onclick={() => reponse(1)}>Raté</button><button onclick={() => reponse(3)}>Difficile</button><button onclick={() => reponse(5)}>Facile</button>
      </div>
    {:else}
      <button class="go" onclick={() => (montre = true)}>Voir la réponse</button>
    {/if}
  {:else}
    <p>Révision terminée.</p>
    <button class="go" onclick={onfini}>Retour</button>
  {/if}
</div>

<style>
  .plaque { background:var(--plaque); border-radius:4px; border-bottom:4px solid var(--ink); padding:.9rem 1rem; margin:.5rem 0 .4rem; }
  h1 { font-size:1.9rem; font-weight:500; line-height:1.1; margin:0; }
  .plaque p { margin:.15rem 0 0; color:var(--mute); font-size:.85rem; }
  .bloc { background:var(--card); border-radius:6px; padding:1rem; margin-top:.8rem; display:grid; gap:.6rem; }
  .bloc p { margin:0; } .mute { color:var(--mute); font-size:.85rem; }
  .terme { font-size:2.2rem; font-weight:500; line-height:1.15; } .gloss { font-size:1.2rem; }
  .notes { display:flex; gap:.5rem; }
  button { font:inherit; color:var(--ink); }
  .go, .notes button { border:0; border-radius:3px; background:var(--ink); color:#1F2326; padding:.65rem 1rem; font-size:.95rem; } .notes button { flex:1; }
  .mini { justify-self:start; border:1px solid var(--line); background:none; border-radius:3px; padding:.2rem .55rem; font-size:.8rem; }
</style>
