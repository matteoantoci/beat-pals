// The load scene in the smoke run (scripts/smoke.ts; spec, "Screens", load scene):
// - A slow load (each audio decode waits 1.5 s first, as on a slow phone) shows the scene, and its ring fills and
//   never goes back.
// - A failed load: from the song list, the audio of the test song leaves the cache, and a tap on its card starts a
//   load that fails. The scene shows the oops moment, and the game goes back to the song list. A return to the app
//   downloads the file again, so the later checks have the song. The parent area shows the problem
//   (scripts/smoke-parent.ts).

import { check, setVisibility, shot, shows, tap, touchHold, wait } from './smoke-page.ts';
import { cachedAgain, dropAudio } from './smoke-setup.ts';
import type { Page } from 'puppeteer-core';

/** The wait before each audio decode of the slow load. The test song decodes too fast to show the scene. */
const SLOW_DECODE_MS = 1500;
const SLOW_LOAD_MS = 10_000;

/**
 * Page code that makes each audio decode wait for `data-smoke-decode-ms` on the root first, installed one time. It
 * is a script tag, as page code: the wrapper keeps the original method and calls it with its own `this`.
 */
const SLOW_DECODE = `{
  const root = document.documentElement;
  if (root.dataset.smokeDecodeMs === undefined) {
    const proto = BaseAudioContext.prototype;
    const decode = proto.decodeAudioData;
    proto.decodeAudioData = async function slow(data) {
      await new Promise((resolve) => setTimeout(resolve, Number(root.dataset.smokeDecodeMs || 0)));
      return decode.call(this, data);
    };
  }
}`;

/** The wait before each audio decode; 0 ends it. Runs in the page. */
const decodeWait = (ms: number): void => {
  document.documentElement.dataset['smokeDecodeMs'] = String(ms);
};

/** The fill of the ring in percent, or -1 when no ring shows. Runs in the page. */
const ringFill = (): number => Number(document.querySelector('.load-ring')?.getAttribute('data-fill') ?? '-1');

/** Reads the ring every 200 ms until the play starts. */
const ringFills = async (page: Page, fills: number[], ms: number): Promise<number[]> => {
  const playing = (await page.$('.play:not(.play-loading)')) !== null;
  if (playing || ms <= 0) {
    return fills;
  }
  const fill = await page.evaluate(ringFill);
  await wait(200);
  return ringFills(page, fill < 0 ? fills : [...fills, fill], ms - 200);
};

/** From the song list: a slow load shows the scene with a ring that fills, and the play starts after it. Then the
 * pause screen goes back to the song list. */
export const slowLoad = async (page: Page, shots: string | undefined): Promise<void> => {
  await page.addScriptTag({ content: SLOW_DECODE });
  await page.evaluate(decodeWait, SLOW_DECODE_MS);
  await tap(page, '.song-cover');
  check('slow load: the load scene shows', await shows(page, '.load-scene', 3000));
  check('slow load: the pause button is hidden', (await page.$('.play-loading .play-hud')) !== null);
  await wait(400);
  await shot(page, shots, 'load-portrait');
  const fills = await ringFills(page, [], SLOW_LOAD_MS);
  await page.evaluate(decodeWait, 0);
  const forward = fills.every((fill, at) => at === 0 || fill >= (fills[at - 1] ?? 0));
  check('slow load: the ring fills and never goes back', fills.length > 1 && forward, fills.join(' '));
  check('slow load: the play starts', await shows(page, '.play:not(.play-loading)', 5000));
  await touchHold(page, '.pause-button', 800);
  await touchHold(page, '.pause-home', 800);
  check('slow load: back to the song list', await shows(page, '.song-list', 3000));
};

const CACHE = 'beat-pals-songs';
const DOWNLOAD_MS = 20_000;
/** The oops moment lasts 1.5 s. */
const BACK_MS = 4000;

export const loadFailure = async (page: Page, shots: string | undefined): Promise<void> => {
  const path = await page.evaluate(dropAudio, CACHE);
  await tap(page, '.song-cover');
  check('failed load: the oops moment shows', await shows(page, '.load-failed', 3000));
  check('failed load: the pals make the oops face', (await page.$$('.load-failed .band-pal img')).length === 3);
  check('failed load: the pause button is hidden', (await page.$('.play-loading .play-hud')) !== null);
  await shot(page, shots, 'load-failed-portrait');
  check('failed load: back to the song list', await shows(page, '.song-list', BACK_MS));
  await page.evaluate(setVisibility, 'hidden');
  await wait(300);
  await page.evaluate(setVisibility, 'visible');
  check('failed load: a return downloads the file again', await cachedAgain(page, path, DOWNLOAD_MS));
  check('failed load: the song card shows again', await shows(page, '.song-card', DOWNLOAD_MS));
};
