// The guided song setup in the smoke run (scripts/smoke.ts; spec, "Testing Decisions", Seam 2):
// - The install step with its 3 pictures in a page that is not a Home Screen app.
// - The key step refuses a text that is not a key code and a wrong key, and takes the key of the test store. The key
//   code goes into the field only; it is never printed.
// - The download shows its progress. Request interception pauses one store file, and the page reloads while it
//   waits, so the reload always comes in the middle of the download. Then the download continues from the next
//   missing file, and only then are the old files deleted.
// - After the setup, a missing file downloads again by itself at the start and at a return to visible.

import { check, setVisibility, shot, shows, tap, wait } from './smoke-page.ts';
import { closeParentArea, openParentArea } from './smoke-parent.ts';
import { daytimeClock } from './smoke-session-store.ts';
import type { Browser, HTTPRequest, Page } from 'puppeteer-core';

/** The download of the one short test song ends well within this time. */
const DOWNLOAD_MS = 20_000;
/** SMOKE_SHOTS=<folder> saves screenshots of the setup steps there. */
const SHOTS = process.env['SMOKE_SHOTS'];
const STORE_FILE = /\/songs\/[0-9a-f]{64}\.bin$/u;
const CACHE = 'beat-pals-songs';
/** A file in the cache that the manifest does not name: a song file of an old store. */
const OLD_FILE = `/beat-pals/songs/${'f'.repeat(64)}.bin`;

const textOf = async (page: Page, selector: string): Promise<string> =>
  (await page.$eval(selector, (el) => el.textContent).catch(() => '')).trim();

/** The paths in the song cache. Runs in the page. */
const cachedPaths = async (cache: string): Promise<string[]> => {
  if (!(await caches.has(cache))) {
    return [];
  }
  const keys = await (await caches.open(cache)).keys();
  return keys.map((request) => new URL(request.url).pathname);
};

/** The install step with its pictures, and no key step. */
const installChecks = async (page: Page): Promise<void> => {
  check('Safari tab: the install step shows', (await textOf(page, '.song-install-title')).includes('Home Screen'));
  await wait(1000);
  const pictures = await page.$$eval(
    '.song-install img',
    (images) => images.filter((image) => image instanceof HTMLImageElement && image.naturalWidth > 0).length
  );
  check('Safari tab: 3 pictures show', pictures === 3, `${String(pictures)} pictures`);
  check('Safari tab: the key step stays hidden', (await page.$('#song-key')) === null);
  await shot(page, SHOTS, 'setup-install');
};

/**
 * The install step shows in a page that is not a Home Screen app, with 3 pictures that load. The page has a browser
 * context of its own, so its service worker and storage do not reach the main page of the run.
 */
export const installStep = async (browser: Browser, url: string): Promise<void> => {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    await page.setViewport({ width: 390, height: 763, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument(daytimeClock);
    await page.goto(url, { waitUntil: 'networkidle2' });
    await ((await openParentArea(page)) ? installChecks(page) : undefined);
  } finally {
    await context.close();
  }
};

/** Puts the code into the key field, in place of its text, and taps Check. */
const enterKey = async (page: Page, code: string): Promise<void> => {
  await page.locator('#song-key').fill(code);
  await tap(page, '.song-key-check');
  await wait(1000);
};

/** The key step refuses a text that is not a key code and a wrong key, and keeps the field. */
const refusedKeys = async (page: Page): Promise<void> => {
  await enterKey(page, 'not a key');
  check(
    'key step: a text that is not a key code is refused',
    (await textOf(page, '.song-note')) === 'This is not a key code'
  );
  // 26 zeros are a valid code of another key.
  const wrong = '0'.repeat(26);
  await enterKey(page, wrong);
  check('key step: a wrong key is refused', (await textOf(page, '.song-note')) === 'This key does not open the songs');
  check(
    'key step: the wrong key stays in the field',
    (await page.$eval('#song-key', (input) => (input instanceof HTMLInputElement ? input.value : ''))) === wrong
  );
};

const wakeLocks = async (page: Page): Promise<number> =>
  page.evaluate(() => Number(document.documentElement.dataset['smokeWakeLocks'] ?? '0'));

/** Taps Download, holds the second store file, and reloads the page while the request waits. */
const reloadDuringDownload = async (page: Page): Promise<void> => {
  const held = Promise.withResolvers<boolean>();
  let files = 0;
  const pause = (request: HTTPRequest): void => {
    const file = STORE_FILE.test(request.url());
    files += file ? 1 : 0;
    if (file && files === 2) {
      held.resolve(true);
      return;
    }
    request.continue().catch(() => undefined);
  };
  page.on('request', pause);
  await page.setRequestInterception(true);
  const locks = await wakeLocks(page);
  await tap(page, '.song-download');
  setTimeout(() => held.resolve(false), DOWNLOAD_MS);
  check('download: a store file waits', await held.promise);
  check('download: the progress shows', (await textOf(page, '.song-progress-text')).startsWith('0 of 1 song, '));
  check('download: the screen stays on', (await wakeLocks(page)) > locks);
  await page.reload();
  page.off('request', pause);
  await page.setRequestInterception(false);
};

/** After the reload, the download step shows the stop and continues from the next missing file. */
const continueDownload = async (page: Page): Promise<void> => {
  check('reload: the old file stays in the cache', (await page.evaluate(cachedPaths, CACHE)).includes(OLD_FILE));
  if (!(await openParentArea(page))) {
    return;
  }
  check('reload: the download shows the stop', await shows(page, '.song-continue'));
  await shot(page, SHOTS, 'setup-stopped');
  const fetched: string[] = [];
  const count = (request: HTTPRequest): void => {
    if (STORE_FILE.test(request.url())) {
      fetched.push(request.url());
    }
  };
  page.on('request', count);
  await tap(page, '.song-continue');
  check('reload: the download continues', await shows(page, '.song-ready', DOWNLOAD_MS));
  page.off('request', count);
  check('reload: only the missing file downloads', fetched.length === 1, `${String(fetched.length)} files`);
  check('complete: the old file is deleted', !(await page.evaluate(cachedPaths, CACHE)).includes(OLD_FILE));
  check(
    'complete: "1 song ready on this iPhone"',
    (await textOf(page, '.song-ready')) === '1 song ready on this iPhone'
  );
  check('complete: the storage result shows', (await textOf(page, '.song-storage')).startsWith('Storage '));
  await shot(page, SHOTS, 'setup-done');
};

/** The key step and the download step of the setup, with a reload in the middle of the download. */
export const songSetup = async (page: Page, keyCode: string): Promise<void> => {
  if (!(await openParentArea(page))) {
    return;
  }
  check('key step: the key field shows', await shows(page, '#song-key'));
  await refusedKeys(page);
  await enterKey(page, keyCode);
  check('key step: the test key opens the store', await shows(page, '.song-key-ok'));
  check('download step: the size shows', (await textOf(page, '.song-size')).startsWith('Download 1 song ('));
  await page.evaluate(async (cache, old) => (await caches.open(cache)).put(old, new Response('old')), CACHE, OLD_FILE);
  await reloadDuringDownload(page);
  await continueDownload(page);
  await closeParentArea(page, 'setup');
};

/** Deletes the largest store file of the kept manifest, the audio of the test song, and gives its path. Runs in the page. */
export const dropAudio = async (cache: string): Promise<string> => {
  const songs = await caches.open(cache);
  const kept = (await (await songs.match('/beat-pals/songs/last/manifest.json'))?.text()) ?? '';
  const files = [...kept.matchAll(/"name":"([0-9a-f]{64})","size":(\d+)/gu)];
  const [largest] = files.toSorted((one, two) => Number(two[2]) - Number(one[2]));
  const path = `/beat-pals/songs/${largest?.[1] ?? ''}.bin`;
  await songs.delete(path);
  return path;
};

/** Waits up to `ms` for the path in the song cache. */
export const cachedAgain = async (page: Page, path: string, ms: number): Promise<boolean> => {
  if ((await page.evaluate(cachedPaths, CACHE)).includes(path)) {
    return true;
  }
  if (ms <= 0) {
    return false;
  }
  await wait(250);
  return cachedAgain(page, path, ms - 250);
};

/** After the setup, a missing file downloads again by itself: at the start, and at a return to visible. */
export const autoDownload = async (page: Page): Promise<void> => {
  const atStart = await page.evaluate(dropAudio, CACHE);
  await page.reload();
  check('after the setup: the start downloads a missing file', await cachedAgain(page, atStart, DOWNLOAD_MS));
  const atReturn = await page.evaluate(dropAudio, CACHE);
  await page.evaluate(setVisibility, 'hidden');
  await wait(300);
  await page.evaluate(setVisibility, 'visible');
  check('after the setup: a return downloads a missing file', await cachedAgain(page, atReturn, DOWNLOAD_MS));
};
