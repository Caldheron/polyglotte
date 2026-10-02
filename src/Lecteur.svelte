<script>
  import { onMount } from 'svelte';
  import { all } from './lib/srs.js';
  let { sujet, onfermer } = $props();
  let texte = $state(''), connus = $state(new Set()), etat = $state('chargement');
  const HAN = /\p{Script=Han}/u;
  onMount(async () => {
    connus = new Set((await all('cards')).filter((c) => c.lang === 'ja' && c.seen).map((c) => c.term));
    try {
      const t = decodeURIComponent(new URL(sujet.cible).pathname.split('/wiki/')[1]);
      const r = await fetch(`https://ja.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=extracts&exintro=1&explaintext=1&redirects=1&origin=*&titles=${encodeURIComponent(t)}`);
      texte = (await r.json()).query.pages[0].extract ?? '';
      etat = texte ? 'ok' : 'vide';
    } catch { etat = 'erreur'; }
  });
  const caracteres = $derived([...texte]);
  const diff = $derived(new Set(caracteres.filter((c) => HAN.test(c))));
  const sus = $derived([...diff].filter((c) => connus.has(c)).length);
</script>

<header class="plaque"><h1>{sujet.titreCible}</h1><p>Wikipédia japonais · kanji connus surlignés</p></header>
<div class="bloc">
  {#if etat === 'chargement'}<p class="mute">Chargement…</p>
  {:else if etat !== 'ok'}<p class="mute">Impossible de charger l'article ici (connexion nécessaire). Ouvre-le directement : <a href={sujet.cible} target="_blank" rel="noopener">Wikipédia</a>.</p>
  {:else}
    <p class="mute">{sus} kanji connu(s) sur {diff.size} kanji différents dans ce passage.</p>
    <p class="texte">{#each caracteres as c}{#if HAN.test(c) && connus.has(c)}<mark>{c}</mark>{:else}{c}{/if}{/each}</p>
    <p class="mute">Texte : <a href={sujet.cible} target="_blank" rel="noopener">Wikipédia</a> (licence CC BY-SA 4.0), introduction de l'article, non modifiée.</p>
  {/if}
  <button onclick={onfermer}>Retour</button>
</div>

<style>
  .plaque { background:var(--plaque); border-radius:4px; border-bottom:4px solid var(--ink); padding:.9rem 1rem; margin:.5rem 0 .4rem; }
  h1 { font-size:1.9rem; font-weight:500; line-height:1.1; margin:0; }
  .plaque p { margin:.15rem 0 0; color:var(--mute); font-size:.85rem; }
  .bloc { background:var(--card); border-radius:6px; padding:1rem; margin-top:.8rem; display:grid; gap:.7rem; }
  .bloc p { margin:0; } .mute { color:var(--mute); font-size:.8rem; }
  .texte { font-size:1.15rem; line-height:1.9; white-space:pre-wrap; }
  mark { background:#6FBF8F; color:#1F2326; border-radius:2px; }
  a { color:var(--ink); }
  button { border:0; border-radius:3px; background:var(--ink); color:#1F2326; padding:.65rem 1rem; font:.95rem "Helvetica Neue",Arial,sans-serif; }
</style>
