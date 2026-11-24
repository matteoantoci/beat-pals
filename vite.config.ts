import solid from '@solidjs/vite-plugin';
import { minimal2023Preset, type Preset } from '@vite-pwa/assets-generator/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The stage colour. Keep the same value in index.html and src/ui/styles.css. public/icon.svg uses it for the record shadow.
const STAGE = '#2C176F';

// The apple and maskable icons fill the whole square with the stage colour, as in Pile Pals. The minimal-2023
// defaults add 30 % white padding, and iOS shows it as a white frame (Pile Pals
// docs/research/native-feel/app-icons.md). resizeOptions replaces the whole default object, so fit must be given again.
const fullBleed = { padding: 0, resizeOptions: { fit: 'contain', background: STAGE } } as const;
const iconPreset = {
  ...minimal2023Preset,
  maskable: { ...minimal2023Preset.maskable, ...fullBleed },
  apple: { ...minimal2023Preset.apple, ...fullBleed },
} satisfies Preset;

// The dev server serves the song store, songs/.site/, at /beat-pals/songs/, as GitHub Pages does (spec,
// "Delivery"). Only the manifest and the store files: songs/ also holds the .sng files and the plain audio, so
// no publicDir, symlink, or server.fs.allow reaches it. songs/ is inside the Vite root, so server.fs.deny also
// blocks the other Vite routes to it (for example /@fs/ or an encoded path such as /beat-pals/%73ongs/).
const SONGS = join(import.meta.dirname, 'songs');
const SONG_STORE = join(SONGS, '.site');
// A value for server.fs.deny replaces the Vite default list, so the list repeats the Vite 8 defaults.
const VITE_DENY = ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**'];
const STORE_PATH = /^\/beat-pals\/songs\/(manifest\.json|[0-9a-f]{64}\.bin)$/u;

const songStore = (): Plugin => ({
  name: 'beat-pals-song-store',
  apply: 'serve',
  config: () => ({ server: { fs: { deny: [...VITE_DENY, join(SONGS, '**')] } } }),
  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
      const path = (request.url ?? '').split('?')[0] ?? '';
      if (!path.startsWith('/beat-pals/songs/')) {
        next();
        return;
      }
      const file = STORE_PATH.exec(path)?.[1];
      const send = (status: number, type: string, body: Uint8Array | string) => {
        response.writeHead(status, { 'Content-Type': type });
        response.end(body);
      };
      if (file === undefined) {
        send(404, 'text/plain', 'Not found');
        return;
      }
      readFile(join(SONG_STORE, file)).then(
        (body) => send(200, file === 'manifest.json' ? 'application/json' : 'application/octet-stream', body),
        () => send(404, 'text/plain', 'Not found')
      );
    });
  },
});

/**
 * The demo route (spec, "Testing Decisions") exists in the dev server and in the smoke build (`vite build --mode
 * smoke`) only. Every other build, as the `deploy` build, sets the flag to false, so the bundler drops the route and
 * its fixture (src/main.tsx).
 */
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the app from https://<user>.github.io/beat-pals/.
  base: '/beat-pals/',
  define: { 'import.meta.env.DEMO': JSON.stringify(mode === 'development' || mode === 'smoke') },
  plugins: [
    solid(),
    songStore(),
    VitePWA({
      // The code, not the Child, accepts an update (src/shell/update.ts).
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { image: 'public/icon.svg', preset: iconPreset },
      manifest: {
        name: 'Beat Pals',
        short_name: 'Beat Pals',
        display: 'standalone',
        background_color: STAGE,
        theme_color: STAGE,
      },
      workbox: {
        // The Pile Pals list plus mp3 (the title music in public/music/), less webmanifest. Each file is below the
        // default limit of 2 MiB (maximumFileSizeToCacheInBytes), so the precache holds all of them.
        // vite-plugin-pwa adds manifest.webmanifest to the precache itself. A glob match adds it a second time with
        // another revision, and then Workbox refuses the whole precache list: the service worker serves nothing,
        // and the app does not start offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,avif,txt,wav,mp3}'],
        // The encrypted songs are never in the precache: the app downloads them on demand (spec, "Delivery").
        globIgnores: ['songs/**'],
      },
    }),
  ],
}));
