<script>
  import { onMount } from 'svelte';
  import { all } from './lib/srs.js';
  import { config } from './lib/scheduler.js';
  import Revision from './Revision.svelte';

  let cartes = $state([]), actif = $state(null);
  const charger = async () => { cartes = (await all('cards')).filter((c) => c.seen); };
  onMount(charger);
  const maintenant = () => Date.now();
  const groupes = $derived(Object.entries(config.langues).map(([id, l]) => {
    const c = cartes.filter((x) => x.lang === id).sort((a, b) => a.term.localeCompare(b.term));
    return { id, nom: l.nom, couleur: l.couleur, c, dues: c.filter((x) => x.due <= maintenant()) };
  }));
  const libre = (c) => [...c].sort((a, b) => a.ef - b.ef || Math.random() - 0.5).slice(0, 10); // les plus fragiles d'abord
  const date = (t) => (t <= maintenant() ? 'à réviser' : new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
</script>

{#if actif}
  <Revision lang={actif.lang} cartes={actif.cartes} libre={actif.libre} onfini={() => { actif = null; charger(); }} />
{:else}
  <header class="plaque"><h1>Cartes</h1><p>{cartes.length} mot(s) en cours d'apprentissage</p></header>
  {#each groupes as g}
    <div class="bloc" style="--c:{g.couleur}">
      <strong>{g.nom}</strong>
      {#if g.c.length}
        <p class="mute">{g.c.length} mot(s) · {g.dues.length} à réviser</p>
        <div class="notes">
          <button disabled={!g.dues.length} onclick={() => (actif = { lang: g.id, cartes: g.dues, libre: false })}>Réviser ({g.dues.length})</button>
          <button class="sec" onclick={() => (actif = { lang: g.id, cartes: libre(g.c), libre: true })}>Entraînement libre</button>
        </div>
        <details><summary>Voir les mots</summary>
          {#each g.c as c}<p class="ligne"><span>{c.term}{c.pinyin ? ` · ${c.pinyin}` : ''}</span><span class="mute">{c.gloss} · {date(c.due)}</span></p>{/each}
        </details>
      {:else}
        <p class="mute">Aucun mot pour l'instant : ils apparaissent après une première session.</p>
      {/if}
    </div>
  {/each}
{/if}

<style>
  .plaque { background:var(--plaque); border-radius:4px; border-bottom:4px solid var(--ink); padding:.9rem 1rem; margin:.5rem 0 .4rem; }
  h1 { font-size:1.9rem; font-weight:500; line-height:1.1; margin:0; }
  .plaque p { margin:.15rem 0 0; color:var(--mute); font-size:.85rem; }
  .bloc { background:var(--card); border-left:6px solid var(--c); border-radius:6px; padding:1rem; margin-top:.8rem; display:grid; gap:.6rem; }
  .bloc p { margin:0; } .mute { color:var(--mute); font-size:.85rem; }
  .notes { display:flex; gap:.5rem; }
  button { flex:1; border:0; border-radius:3px; background:var(--ink); color:#1F2326; padding:.65rem .5rem; font:.9rem "Helvetica Neue",Arial,sans-serif; }
  button.sec { background:none; color:var(--ink); border:1px solid var(--line); }
  button:disabled { opacity:.4; }
  summary { color:var(--mute); font-size:.85rem; }
  .ligne { display:flex; justify-content:space-between; gap:.5rem; padding:.3rem 0; border-top:1px solid var(--line); }
</style>
