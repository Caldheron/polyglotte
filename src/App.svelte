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
    ['synchro', 'Synchro', 'étapes 2 et 4']
  ];
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const code = { es: 'ES', zh: 'ZH', ja: 'JA' };
</script>

<main>
  {#if onglet === 'today'}
    {@const liste = slotsDu(jour)}
    <p class="date">{date}</p>
    <header class="plaque">
      <h1>{jour === aujourdhui ? "Aujourd'hui" : jour}</h1>
      <p>{minutesDu(jour)} min · {liste.length} station{liste.length > 1 ? 's' : ''}</p>
    </header>

    <p class="label">Ligne du jour</p>
    <ol class="ligne">
      {#each liste as s, i}
        <li style="--c:{s.langue.couleur}">
          <div class="rail">
            <span class="seg haut" class:vide={i === 0}></span>
            <span class="node"></span>
            <span class="seg bas" class:vide={i === liste.length - 1}></span>
          </div>
          <div class="card">
            <span class="rond">{code[s.lang] ?? s.lang.toUpperCase()}</span>
            <div class="txt">
              <strong>{s.langue.nom}</strong>
              <span>{s.slot} · {s.type}</span>
            </div>
            <span class="min">{s.minutes}<small>min</small></span>
          </div>
        </li>
      {/each}
    </ol>

    <nav class="semaine" aria-label="Semaine">
      {#each ORDRE as j}
        <button class:actif={j === jour} onclick={() => (jour = j)}>
          {j.slice(0, 3)}<small>{minutesDu(j)}</small>
        </button>
      {/each}
    </nav>
    <p class="hebdo">Semaine : {totalSemaine()} min</p>
  {:else}
    {@const o = onglets.find((x) => x[0] === onglet)}
    <header class="plaque"><h1>{o[1]}</h1></header>
    <p class="vide">Cet écran arrive à l'{o[2]}. Rien à faire ici pour l'instant.</p>
  {/if}
</main>

<nav class="tabs">
  {#each onglets as [id, nom]}
    <button class:actif={onglet === id} onclick={() => (onglet = id)}>{nom}</button>
  {/each}
</nav>

<style>
  :global(:root) { --bg:#2B2F33; --plaque:#1E2225; --card:#383D42; --tabs:#23272A; --ink:#DDE0E2; --mute:#9AA3A9; --line:#4A5158; }
  :global(body) { margin:0; background:var(--bg); color:var(--ink);
    font:16px/1.4 "Helvetica Neue",Arial,sans-serif; padding:env(safe-area-inset-top) 0 0; }
  main { max-width:32rem; margin:0 auto; padding:1.25rem 1rem 6rem; }
  .date { margin:0; color:var(--mute); font-size:.85rem; text-transform:capitalize; }
  .plaque { background:var(--plaque); border-radius:4px; border-bottom:4px solid var(--ink); padding:.9rem 1rem; margin:.5rem 0 .4rem; }
  h1 { font-size:1.9rem; font-weight:500; line-height:1.1; margin:0; text-transform:capitalize; }
  .plaque p { margin:.15rem 0 0; color:var(--mute); font-size:.85rem; }
  .label, .hebdo, .vide { color:var(--mute); font-size:.8rem; }
  .label { margin:1rem 0 .2rem; }
  .ligne { list-style:none; padding:0; margin:0 0 1.2rem; }
  .ligne li { display:flex; gap:.75rem; }
  .rail { width:22px; display:flex; flex-direction:column; align-items:center; flex:none; }
  .seg { width:6px; background:var(--c); }
  .seg.haut { height:22px; }
  .seg.bas { flex:1; }
  .seg.vide { background:transparent; }
  .node { width:18px; height:18px; box-sizing:border-box; border-radius:50%; border:4px solid var(--c); background:var(--bg); flex:none; }
  .card { flex:1; display:flex; align-items:center; gap:.75rem; background:var(--card); border-radius:6px; padding:.75rem; margin:5px 0; }
  .rond { width:38px; height:38px; border-radius:50%; background:var(--c); color:#1F2326; font-size:.85rem;
    font-weight:500; display:flex; align-items:center; justify-content:center; flex:none; }
  .txt { display:grid; gap:.05rem; }
  .txt strong { font-weight:500; }
  .txt span { color:var(--mute); font-size:.78rem; }
  .min { margin-left:auto; font-size:1.5rem; font-weight:500; line-height:1; }
  .min small { font-size:.7rem; color:var(--mute); margin-left:2px; }
  .semaine { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
  .semaine button { border:0; background:var(--card); color:var(--ink); border-radius:3px; padding:.45rem 0;
    font:.75rem "Helvetica Neue",Arial,sans-serif; text-transform:capitalize; }
  .semaine small { display:block; color:var(--mute); font-size:.7rem; }
  .semaine .actif { background:var(--ink); color:#1F2326; }
  .semaine .actif small { color:var(--line); }
  .tabs { position:fixed; bottom:0; left:0; right:0; display:flex; background:var(--tabs); padding-bottom:env(safe-area-inset-bottom); }
  .tabs button { flex:1; border:0; background:none; padding:.85rem .1rem; font:.7rem "Helvetica Neue",Arial,sans-serif; color:var(--mute); }
  .tabs .actif { color:var(--ink); font-weight:500; box-shadow:inset 0 3px var(--ink); }
  button:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
</style>
