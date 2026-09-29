import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// base './' : fonctionne que l'app soit à la racine de caldheron.github.io ou dans un sous-dossier.
export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Polyglotte',
        short_name: 'Polyglotte',
        description: "Plan d'apprentissage des langues",
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#2B2F33',
        theme_color: '#2B2F33',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,json}'] }
    })
  ]
});
