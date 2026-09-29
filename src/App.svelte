<script>
  import { ORDRE, jourDe, slotsDu, minutesDu, totalSemaine } from './lib/scheduler.js';

  const aujourdhui = jourDe();
  let jour = $state(aujourdhui);
  let onglet = $state('today');
  const onglets = [
    ['today', "Aujourd'hui", null],
    ['cartes', 'Cartes', 'étape 3'],
    ['lecture', 'Lecture', 'étape 3'],
    ['prod', 'Production', 'étape 4'],
    ['progres', 'Progrès', 'étape 5'],
    ['synchro', 'Synchro', 'étape 2 et 4']
  ];
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
</script>

<main>
  {#if onglet === 'today'}
    <header>
      <p class="date">{date}</p>
      <h1>{jour === aujourdhui ? "Aujourd'hui" : jour}</h1>
      <p class="total">{minutesDu(jour)} min · {slotsDu(jour).length} créneau{slotsDu(jour).length > 1 ? 'x' : ''}</p>
    </header>

    <ul class="slots">
      {#each slotsDu(jour) as s}
        <li style="--c:{s.langue.couleur}">
          <span class="min">{s.minutes}<small>min</small></span>
          <div>
            <strong>{s.langue.nom}</strong>
            <span>{s.slot} — {s.type}</span>
            <em>Phase : {s.langue.phase}</em>
          </div>
        </li>
      {/each}
    </ul>

    <nav class="semaine" aria-label="Semaine">
      {#each ORDRE as j}
        <button class:actif={j === jour} class:auj={j === aujourdhui} onclick={() => (jour = j)}>
          {j.slice(0, 3)}<small>{minutesDu(j)}</small>
        </button>
      {/each}
    </nav>
    <p class="hebdo">Semaine : {totalSemaine()} min</p>
  {:else}
    {@const o = onglets.find((x) => x[0] === onglet)}
    <header><h1>{o[1]}</h1></header>
    <p class="vide">Cet écran arrive à l'{o[2]}. Rien à faire ici pour l'instant.</p>
  {/if}
</main>

<nav class="tabs">
  {#each onglets as [id, nom]}
    <button class:actif={onglet === id} onclick={() => (onglet = id)}>{nom}</button>
  {/each}
</nav>

<style>
  :global(:root) { --bg:#EEF1EC; --ink:#1B2B34; --mute:#5E6E74; --card:#FFFFFF; --line:#D5DBD3; }
  :global(body) { margin:0; background:var(--bg); color:var(--ink); font:16px/1.45 system-ui,sans-serif;
    padding:env(safe-area-inset-top) 0 0; }
  main { max-width:32rem; margin:0 auto; padding:1.25rem 1rem 6rem; }
  h1 { font:600 2.4rem/1.05 "Iowan Old Style",Palatino,Georgia,serif; margin:.1rem 0 .3rem; text-transform:capitalize; }
  .date { margin:0; color:var(--mute); text-transform:capitalize; }
  .total, .hebdo, .vide { color:var(--mute); }
  .slots { list-style:none; padding:0; margin:1.4rem 0; display:grid; gap:.75rem; }
  .slots li { display:flex; gap:1rem; align-items:center; background:var(--card); border-left:6px solid var(--c);
    border-radius:6px; padding:1rem; }
  .min { font:600 2rem/1 "Iowan Old Style",Palatino,Georgia,serif; color:var(--c); min-width:3.6rem; }
  .min small { font:.8rem system-ui; margin-left:.15rem; }
  .slots div { display:grid; gap:.1rem; }
  .slots span, .slots em { color:var(--mute); font-size:.92rem; }
  .semaine { display:grid; grid-template-columns:repeat(7,1fr); gap:.3rem; }
  .semaine button { border:1px solid var(--line); background:transparent; border-radius:6px; padding:.5rem 0;
    font:inherit; color:var(--ink); text-transform:capitalize; }
  .semaine small { display:block; color:var(--mute); }
  .semaine .auj { border-color:var(--ink); }
  .semaine .actif { background:var(--ink); color:var(--bg); }
  .semaine .actif small { color:var(--bg); }
  .tabs { position:fixed; bottom:0; left:0; right:0; display:flex; background:var(--card); border-top:1px solid var(--line);
    padding-bottom:env(safe-area-inset-bottom); }
  .tabs button { flex:1; border:0; background:none; padding:.9rem .1rem; font:.72rem system-ui; color:var(--mute); }
  .tabs .actif { color:var(--ink); font-weight:700; box-shadow:inset 0 3px var(--ink); }
  button:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
</style>
