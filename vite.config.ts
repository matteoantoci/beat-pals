import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import solid from 'vite-plugin-solid';

// The stage colour. Keep the same value in index.html and src/ui/styles.css.
const STAGE = '#3B2A6B';

export default defineConfig({
  // GitHub Pages serves the app from https://<user>.github.io/beat-pals/.
  base: '/beat-pals/',
  plugins: [
    solid(),
    VitePWA({
      // The code, not the Child, accepts an update (src/shell/update.ts).
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { image: 'public/icon.svg', preset: 'minimal-2023' },
      manifest: {
        name: 'Beat Pals',
        short_name: 'Beat Pals',
        display: 'standalone',
        background_color: STAGE,
        theme_color: STAGE,
      },
      workbox: {
        // The Pile Pals list plus mp3 (the title music in public/music/). Each file is below the default limit
        // of 2 MiB (maximumFileSizeToCacheInBytes), so the precache holds all of them.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,avif,txt,webmanifest,wav,mp3}'],
        // The encrypted songs are never in the precache: the app downloads them on demand (spec, "Delivery").
        globIgnores: ['songs/**'],
      },
    }),
  ],
});
