<script>
  import { onMount } from 'svelte';
  import { avecCles } from './lib/srs.js';
  import { lireReglages, sauverReglages, tester, evaluerEnAttente } from './lib/eval.js';

  let { mode } = $props(); // 'prod' : mes productions et feedbacks ; 'synchro' : connexion à Qwen
  let reg = $state(lireReglages()), liste = $state([]), msg = $state(''), occupe = $state(false);
  const attente = $derived(liste.filter((p) => !p.evalue).length);
  const charger = async () => { liste = (await avecCles('productions')).sort((a, b) => b.date - a.date); };
  onMount(charger);

  async function essayer() {
    sauverReglages(reg); occupe = true; msg = 'Test en cours…';
    try {
      const noms = await tester(reg);
      msg = noms.includes(reg.model) ? 'Connexion OK, modèle trouvé.' : `Connexion OK, mais « ${reg.model} » est introuvable. Disponibles : ${noms.join(', ')}`;
    } catch (e) { msg = `Échec de la connexion : ${e.message}`; }
    occupe = false;
  }
  async function evaluer() {
    sauverReglages(reg); occupe = true; msg = 'Évaluation en cours… (peut prendre une minute par texte)';
    const { n, erreur } = await evaluerEnAttente(reg);
    msg = `${n} production(s) évaluée(s).${erreur ? ` Interrompu : ${erreur}` : ''}`;
    occupe = false; await charger();
  }
  const date = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
</script>

<header class="plaque"><h1>{mode === 'prod' ? 'Production' : 'Synchro'}</h1>
  <p>{attente} production(s) en attente d'évaluation</p></header>

{#if mode === 'synchro'}
  <div class="bloc">
    <label>Adresse du serveur Qwen<input bind:value={reg.url} placeholder="https://mon-pc.mon-reseau.ts.net:8443" autocapitalize="off" autocomplete="off" /></label>
    <label>Modèle<input bind:value={reg.model} autocapitalize="off" /></label>
    <div class="notes">
      <button disabled={occupe || !reg.url} onclick={essayer}>Tester la connexion</button>
      <button disabled={occupe || !reg.url || !attente} onclick={evaluer}>Évaluer maintenant</button>
    </div>
    <p class="mute">{msg}</p>
    <p class="mute">Tailscale doit être actif sur le téléphone. L'adresse reste sur cet appareil. À l'ouverture de l'app, les productions en attente sont évaluées automatiquement si le serveur répond.</p>
  </div>
{:else}
  {#each liste as p}
    <div class="bloc">
      <p class="mute">{p.lang.toUpperCase()} · {date(p.date)} · {p.evalue ? 'évaluée' : 'en attente'}</p>
      <p class="mute">{p.prompt}</p>
      <p>{p.texte}</p>
      {#if p.feedback}
        {@const f = p.feedback}
        <p><strong>Niveau estimé : {f.niveau}</strong> · note {f.note}/10</p>
        {#each f.erreurs as e}<p class="err"><s>{e.original}</s> → {e.correction}<br /><span class="mute">{e.explication}</span></p>{/each}
        {#each f.points_forts as pf}<p>+ {pf}</p>{/each}
        <p class="mute">{f.conseil}</p>
        <p class="mute">Évaluation automatique par {f.model} : indicative, elle peut se tromper.</p>
      {/if}
    </div>
  {:else}
    <p class="mute">Aucune production pour l'instant. Elles apparaissent ici après une session avec production écrite.</p>
  {/each}
{/if}

<style>
  .plaque { background:var(--plaque); border-radius:4px; border-bottom:4px solid var(--ink); padding:.9rem 1rem; margin:.5rem 0 .4rem; }
  h1 { font-size:1.9rem; font-weight:500; line-height:1.1; margin:0; }
  .plaque p { margin:.15rem 0 0; color:var(--mute); font-size:.85rem; }
  .bloc { background:var(--card); border-radius:6px; padding:1rem; margin-top:.8rem; display:grid; gap:.6rem; }
  .bloc p { margin:0; }
  .mute { color:var(--mute); font-size:.85rem; }
  .err { border-left:3px solid #D9726F; padding-left:.6rem; }
  label { display:grid; gap:.25rem; font-size:.85rem; color:var(--mute); }
  input { background:var(--bg); color:var(--ink); border:1px solid var(--line); border-radius:3px; padding:.6rem; font:1rem inherit; }
  .notes { display:flex; gap:.5rem; flex-wrap:wrap; }
  button { flex:1; border:0; border-radius:3px; background:var(--ink); color:#1F2326; padding:.65rem 1rem; font:.95rem "Helvetica Neue",Arial,sans-serif; }
  button:disabled { opacity:.4; }
</style>
