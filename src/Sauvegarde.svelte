<script>
  import { exporterTout, importerTout } from './lib/srs.js';
  let msg = $state('');
  async function exporter() {
    const d = await exporterTout();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' }));
    a.download = `polyglotte-sauvegarde-${d.date.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    msg = `Exporté : ${d.cards.length} cartes, ${d.results.length} sessions, ${d.productions.length} productions, ${d.lus.length} lecture(s) marquée(s).`;
  }
  async function importer(e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!confirm('Remplacer TOUTES les données de cet appareil par cette sauvegarde ?')) return;
      const n = await importerTout(d);
      msg = `Importé : ${n.cards} cartes, ${n.results} sessions, ${n.productions} productions, ${n.lus} lecture(s) marquée(s).`;
    } catch (err) { msg = `Import impossible : ${err.message}. Rien n'a été modifié.`; }
    e.target.value = '';
  }
</script>

<div class="bloc">
  <strong>Sauvegarde</strong>
  <p class="mute">À faire avant de changer de téléphone ou de vider les données du site. Le fichier ne contient pas l'adresse du serveur.</p>
  <div class="notes">
    <button onclick={exporter}>Exporter</button>
    <label class="bouton">Importer<input type="file" accept="application/json,.json" onchange={importer} hidden /></label>
  </div>
  <p class="mute">{msg}</p>
</div>

<style>
  .bloc { background:var(--card); border-radius:6px; padding:1rem; margin-top:.8rem; display:grid; gap:.6rem; }
  .bloc p { margin:0; } .mute { color:var(--mute); font-size:.85rem; }
  .notes { display:flex; gap:.5rem; }
  button, .bouton { flex:1; text-align:center; border:0; border-radius:3px; background:var(--ink); color:#1F2326; padding:.65rem 1rem; font:.95rem "Helvetica Neue",Arial,sans-serif; }
</style>
