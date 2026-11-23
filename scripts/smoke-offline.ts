// The offline part of the smoke run (scripts/smoke.ts; spec, "Testing Decisions", Seam 2). The run stops the preview
// server and reloads, so the page and the service worker both have no network (page.setOfflineMode does not reach
// the service worker). Then the app starts from the service worker, the song list comes from the last manifest, and
// the song plays from Cache Storage. Last, "Change key" clears the songs and the key, also offline.

import { check, shows, tap, wait } from './smoke-page.ts';
import { openParentArea } from './smoke-parent.ts';
import type { AudioRecord } from './smoke-audio.ts';
import type { Page } from 'puppeteer-core';

const CACHE = 'beat-pals-songs';

/** The number of entries in the song cache. Runs in the page. */
const cachedCount = async (cache: string): Promise<number> =>
  (await caches.has(cache)) ? (await (await caches.open(cache)).keys()).length : 0;

/** The song plays with no network. */
const offlinePlay = async (page: Page, audio: AudioRecord): Promise<void> => {
  await page.reload().catch(() => undefined);
  const shown = await shows(page, '.title .logo');
  check('offline: the service worker starts the app', shown, shown ? '' : (await page.content()).slice(0, 300));
  await tap(page, '.title');
  check('offline: the song list shows the test song', await shows(page, '.song-card'));
  audio.reset();
  await tap(page, '.song-cover');
  check('offline: the play screen shows', await shows(page, '.play'));
  await wait(2500);
  const states = audio.contexts();
  check(
    'offline: the song plays',
    (states === '' || states.endsWith('running')) && audio.sources() > 0,
    `${states}, ${String(audio.sources())} sources`
  );
};

/** The parent area shows the offline state, and "Change key" clears the songs and the key. */
const offlineParent = async (page: Page): Promise<void> => {
  await page.reload();
  if (!(await openParentArea(page))) {
    return;
  }
  const state = await page.$eval('.song-offline', (el) => el.textContent).catch(() => '');
  check('offline: "Offline: 1 song ready on this iPhone"', state === 'Offline: 1 song ready on this iPhone', state);
  await tap(page, '.song-change-key');
  check('Change key: the key step shows', await shows(page, '#song-key'));
  check('Change key: the songs are deleted', (await page.evaluate(cachedCount, CACHE)) === 0);
  check(
    'Change key: the setup starts again',
    (await page.evaluate(() => localStorage.getItem('beat-pals:setup'))) === null
  );
};

/** Stops the preview server with `stop`, and then plays and opens the parent area with no network. */
export const offlineChecks = async (page: Page, audio: AudioRecord, stop: () => Promise<void>): Promise<void> => {
  const control = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const state = registration?.active?.state ?? 'none';
    return `${navigator.serviceWorker.controller === null ? 'no controller' : 'controlled'}, ${state}`;
  });
  check('online: a service worker controls the page', control.startsWith('controlled'), control);
  await stop();
  await offlinePlay(page, audio);
  await offlineParent(page);
};
