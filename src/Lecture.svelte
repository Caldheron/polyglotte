<script>
  import { onMount } from 'svelte';
  import { config } from './lib/scheduler.js';
  import Lecteur from './Lecteur.svelte';
  let lecteur = $state(null);
  let data = $state(undefined), lus = $state(new Set(JSON.parse(localStorage.getItem('polyglotte.lu') ?? '[]')));
  onMount(async () => { try { const r = await fetch('./culture.json'); data = r.ok ? await r.json() : null; } catch { data = null; } });
  function basculer(id) {
    const s = new Set(lus); s.has(id) ? s.delete(id) : s.add(id);
    lus = s; localStorage.setItem('polyglotte.lu', JSON.stringify([...s]));
  }
  const groupes = $derived(Object.entries(config.langues).map(([id, l]) => ({
    id, nom: l.nom, couleur: l.couleur,
    sujets: (data?.sujets ?? []).filter((s) => s.langue === id).sort((a, b) => lus.has(a.id) - lus.has(b.id) || a.theme.localeCompare(b.theme))
  })).filter((g) => g.sujets.length));
</script>

{#if lecteur}
  <Lecteur sujet={lecteur} onfermer={() => (lecteur = null)} />
{:else}
<header class="plaque"><h1>Lecture</h1><p>Immersion culturelle : Wikipédia en français et dans la langue</p></header>
{#if data === null}
  <p class="mute">Aucun sujet trouvé. Génère la liste depuis ton PC avec <code>node content-engine/culture.mjs</code>.</p>
{:else if data}
  {#each groupes as g}
    <div class="bloc" style="--c:{g.couleur}">
      <strong>{g.nom}</strong>
      {#each g.sujets as s}
        <div class="sujet" class:lu={lus.has(s.id)}>
          <div><span class="mute">{s.theme}</span><br />{s.titre}</div>
          <div class="liens">
            <a href={s.fr} target="_blank" rel="noopener">FR</a>
            <a href={s.cible} target="_blank" rel="noopener">{s.langue.toUpperCase()} · {s.titreCible}</a>
            {#if s.langue === 'ja'}<button class="lire" onclick={() => (lecteur = s)}>Lire ici</button>{/if}
            <button onclick={() => basculer(s.id)} aria-label="Marquer comme lu">{lus.has(s.id) ? '✓' : '○'}</button>
          </div>
        </div>
      {/each}
    </div>
  {/each}
  <p class="mute">Les liens s'ouvrent dans le navigateur (connexion nécessaire). Les articles sont écrits par Wikipédia, rien n'est généré par Qwen. Les « lus » restent sur cet appareil, hors sauvegarde.</p>
{/if}
{/if}

<style>
  .plaque { background:var(--plaque); border-radius:4px; border-bottom:4px solid var(--ink); padding:.9rem 1rem; margin:.5rem 0 .4rem; }
  h1 { font-size:1.9rem; font-weight:500; line-height:1.1; margin:0; }
  .plaque p { margin:.15rem 0 0; color:var(--mute); font-size:.85rem; }
  .bloc { background:var(--card); border-left:6px solid var(--c); border-radius:6px; padding:1rem; margin-top:.8rem; display:grid; gap:.7rem; }
  .mute { color:var(--mute); font-size:.8rem; }
  .sujet { display:grid; gap:.35rem; padding-top:.6rem; border-top:1px solid var(--line); } .sujet.lu { opacity:.55; }
  .liens { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
  a { color:#1F2326; background:var(--ink); border-radius:3px; padding:.3rem .6rem; font-size:.85rem; text-decoration:none; }
  button.lire { margin-left:0; background:none; }
  button { margin-left:auto; border:1px solid var(--line); background:none; color:var(--ink); border-radius:3px; padding:.25rem .6rem; }
</style>
