// Browser smoke run of the built app: `pnpm smoke`. It is a dev tool, not a test of the game model.
// The `smoke` script in package.json runs `vite build` first. This file puts the test store into dist/songs/ and
// serves dist/ with `vite preview` through portless, under a name unique to the run, so 2 checkouts can run it at the
// same time.
// Chromium cannot show the iOS audio rules (see the Pile Pals docs/agents/ios-device.md), so a pass here does not
// prove the iPhone behaviour. It uses the default install of Google Chrome on macOS.
// SMOKE_SHOTS=<folder> saves screenshots of the screens there. SMOKE_NAME=<name> gives the portless name of the run,
// for a look in a browser at https://<name>.localhost while the run waits; the default is unique to the run.
// SMOKE_DEMO_SHOTS=<folder> saves the screenshots of the demo route there (scripts/smoke-demo.ts).
// The `smoke` script builds with `--mode smoke`, so the build has the demo route (vite.config.ts).

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { launch } from 'puppeteer-core';
import { allowModelImports } from './prepare/model-imports.ts';
import { recordAudio } from './smoke-audio.ts';
import { demoChecks } from './smoke-demo.ts';
import { loadFailure, slowLoad } from './smoke-load.ts';
import { offlineChecks } from './smoke-offline.ts';
import { check, checkLines, setVisibility, shot, tap, wait } from './smoke-page.ts';
import { parentSections } from './smoke-parent.ts';
import { playChecks } from './smoke-play.ts';
import { sessionChecks } from './smoke-session.ts';
import { autoDownload, installStep, songSetup } from './smoke-setup.ts';
import type { AudioRecord } from './smoke-audio.ts';
import type { ChildProcess } from 'node:child_process';
import type { Browser, Page } from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const NAME = process.env['SMOKE_NAME'] ?? `bp-smoke-${String(process.pid)}`;
const SHOTS = process.env['SMOKE_SHOTS'];
const READY_MS = 30_000;
const DIST = join(import.meta.dirname, '..', 'dist');

type Server = { readonly url: string; readonly child: ChildProcess };

/**
 * Starts `vite preview` through portless. portless gives the port in $PORT. The shell prints it before vite starts,
 * and the script waits until vite prints its URL.
 */
const startPreview = async (): Promise<Server> => {
  const child = spawn(
    'portless',
    [
      NAME,
      'sh',
      '-c',
      'echo "smoke-port=$PORT"; exec node_modules/.bin/vite preview --host 127.0.0.1 --port "$PORT" --strictPort',
    ],
    { stdio: ['ignore', 'pipe', 'inherit'], detached: true }
  );
  const lines = createInterface({ input: child.stdout });
  const ready = Promise.withResolvers<string>();
  let port = '';
  lines.on('line', (line) => {
    port = /smoke-port=(\d+)/u.exec(line)?.[1] ?? port;
    if (port && line.includes('Local:')) {
      ready.resolve(port);
    }
  });
  child.on('exit', () => ready.reject(new Error('portless did not start vite preview.')));
  const timer = setTimeout(() => child.kill(), READY_MS);
  await ready.promise.finally(() => clearTimeout(timer));
  return { url: `http://127.0.0.1:${port}/beat-pals/`, child };
};

/** Stops portless and vite: the whole process group. A second call does nothing. */
const stopPreview = async ({ child }: Server): Promise<void> => {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  process.kill(-child.pid, 'SIGTERM');
  await once(child, 'exit');
};

/**
 * Puppeteer refuses to emulate display-mode, so the page gets the standalone signs of an iPhone home screen app:
 * `navigator.standalone` and a `matchMedia` that matches `(display-mode: standalone)`.
 */
const standalone = (): void => {
  Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
  const original = globalThis.matchMedia.bind(globalThis);
  globalThis.matchMedia = (query: string): MediaQueryList => {
    const list = original(query);
    if (!query.includes('display-mode')) {
      return list;
    }
    return Object.defineProperty(list, 'matches', { value: query.includes('standalone') });
  };
};

/** Counts the wake lock requests of the page in `data-smoke-wake-locks` on the root element. */
const countWakeLocks = (): void => {
  if (!('wakeLock' in navigator)) {
    return;
  }
  const request = navigator.wakeLock.request.bind(navigator.wakeLock);
  navigator.wakeLock.request = async (type) => {
    const root = document.documentElement;
    root.dataset['smokeWakeLocks'] = String(Number(root.dataset['smokeWakeLocks'] ?? '0') + 1);
    return request(type);
  };
};

/**
 * One tap on the title screen starts the music. With no songs, the play button does not show and the title screen
 * stays, so the child never sees an empty song list.
 */
const titleTap = async (page: Page, audio: AudioRecord): Promise<void> => {
  check('standalone display mode', await page.evaluate(() => matchMedia('(display-mode: standalone)').matches));
  check('title screen shows the logo', (await page.$('.title .logo')) !== null);
  audio.reset();
  await tap(page, '.title');
  await wait(1500);
  check('title tap: context runs', audio.contexts().endsWith('running'), audio.contexts());
  check('title tap: music plays', audio.sources() > 0, `${String(audio.sources())} sources`);
  check('no songs yet: no play button', (await page.$('.title-play')) === null);
  check('no songs yet: the title screen stays', (await page.$('.song-list')) === null);
  await shot(page, SHOTS, 'title-no-songs-portrait');
};

/** A trip to the background marks the context stale. The next tap on the title screen replaces it, and the title
 * music starts again. */
const titleAfterBackground = async (page: Page, audio: AudioRecord): Promise<void> => {
  await page.evaluate(setVisibility, 'hidden');
  await wait(300);
  await page.evaluate(setVisibility, 'visible');
  await wait(300);
  audio.reset();
  await tap(page, '.title');
  await wait(1500);
  const states = audio.contexts();
  check('background trip: tap replaces the context', states.includes('closed') && states.includes('new'), states);
  check('background trip: new context runs', states.includes('running'), states);
  check('background trip: music plays again', audio.sources() > 0, `${String(audio.sources())} sources`);
};

const runAll = async (browser: Browser, server: Server, keyCode: string): Promise<void> => {
  // The demo page registers no service worker and writes no save, so it changes nothing for the other checks.
  await demoChecks(browser, server.url);
  await installStep(browser, server.url);
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 763, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(standalone);
  await page.evaluateOnNewDocument(countWakeLocks);
  const audio = await recordAudio(await page.createCDPSession());
  await page.goto(server.url, { waitUntil: 'networkidle2' });
  await titleTap(page, audio);
  await titleAfterBackground(page, audio);
  await songSetup(page, keyCode);
  await autoDownload(page);
  await playChecks(page, audio, SHOTS);
  await slowLoad(page, SHOTS);
  await loadFailure(page, SHOTS);
  await parentSections(page);
  // The session steps run after the other online steps, and the offline part stays last: it stops the server.
  await sessionChecks(page, audio, server.url);
  await offlineChecks(page, audio, async () => stopPreview(server));
};

const smoke = async (server: Server, keyCode: string): Promise<void> => {
  const browser = await launch({ executablePath: CHROME, headless: true });
  try {
    await runAll(browser, server, keyCode);
  } finally {
    await browser.close();
  }
};

allowModelImports();
// A dynamic import: the resolve hook of allowModelImports must be in place before Node resolves the game model.
const { buildSmokeStore } = await import('./smoke-store.ts');
const keyCode = await buildSmokeStore(DIST);
const server = await startPreview();
try {
  await smoke(server, keyCode);
} finally {
  await stopPreview(server);
}

console.log(checkLines().join('\n'));
const failures = checkLines().filter((line) => line.startsWith('FAIL'));
if (failures.length > 0) {
  throw new Error(`${String(failures.length)} smoke checks failed.`);
}
