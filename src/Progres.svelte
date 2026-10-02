<script>
  import { onMount } from 'svelte';
  import { calculer } from './lib/stats.js';
  let s = $state(null);
  onMount(async () => { s = await calculer(); });
  const pct = (x) => (x === null ? '—' : `${Math.round(x * 100)} %`);
</script>

<header class="plaque"><h1>Progrès</h1>
  {#if s}<p>{s.serie} jour(s) d'affilée · {s.semaine} jour(s) actif(s) sur 7</p>{/if}</header>

{#if s}
  {#each s.langues as l}
    <div class="bloc" style="--c:{l.couleur}">
      <strong>{l.nom}</strong>
      {#if l.sessions || l.cartes}
        <div class="grille">
          <span><b>{l.vues}</b>mots vus</span><span><b>{l.dues}</b>à réviser</span><span><b>{l.mures}</b>bien acquis</span>
          <span><b>{l.sessions}</b>sessions</span><span><b>{pct(l.moyenne)}</b>réussite (5 dernières)</span><span><b>{l.niveau ?? '—'}</b>niveau estimé</span>
        </div>
        <p class="mute">{l.conseil}</p>
      {:else}
        <p class="mute">Pas encore de données.</p>
      {/if}
    </div>
  {/each}
  <p class="mute note">Les conseils sont des suggestions : rien ne change tout seul dans ton planning. « Niveau estimé » vient de l'évaluation automatique de tes productions écrites, à prendre comme indicatif.</p>
{/if}

<style>
  .plaque { background:var(--plaque); border-radius:4px; border-bottom:4px solid var(--ink); padding:.9rem 1rem; margin:.5rem 0 .4rem; }
  h1 { font-size:1.9rem; font-weight:500; line-height:1.1; margin:0; }
  .plaque p { margin:.15rem 0 0; color:var(--mute); font-size:.85rem; }
  .bloc { background:var(--card); border-left:6px solid var(--c); border-radius:6px; padding:1rem; margin-top:.8rem; display:grid; gap:.6rem; }
  .grille { display:grid; grid-template-columns:repeat(3,1fr); gap:.6rem; }
  .grille span { display:grid; font-size:.72rem; color:var(--mute); }
  .grille b { font-size:1.4rem; font-weight:500; color:var(--ink); }
  .mute { color:var(--mute); font-size:.85rem; margin:0; }
  .note { margin-top:1rem; }
</style>
