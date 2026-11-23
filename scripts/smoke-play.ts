// The play part of the smoke run (scripts/smoke.ts): the song list with the test song, a play with a running audio
// context, a hit seen through `data-last-hit` (the hit effects are PixiJS drawings), the layout in portrait and in
// landscape, the pause hold, the sound after a return from the background, home from the pause screen, and a play
// to the end of the song. SMOKE_SHOTS=<folder> also saves screenshots of the song list, the play in portrait and
// in landscape, and the pause screen.

import { check, setVisibility, shot, shows, tap, touchHold, wait } from './smoke-page.ts';
import type { AudioRecord } from './smoke-audio.ts';
import type { Page } from 'puppeteer-core';

const PORTRAIT = { width: 390, height: 763, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const;
const LANDSCAPE = { ...PORTRAIT, width: 844, height: 390 } as const;
/** The test song lasts 15 s; the end goes back to the song list. */
const SONG_END_MS = 25_000;
const HIT_SIGN = /^1 (?:great|good) \d+\.\d{3}$/u;

/** Taps in the middle of Dot's lane every 150 ms. The notes come every second, so some taps hit. */
const tapDot = async (page: Page, taps: number): Promise<void> => {
  if (taps === 0) {
    return;
  }
  const { width, height } = page.viewport() ?? PORTRAIT;
  await page.touchscreen.tap(width / 2, height / 2);
  await wait(150);
  await tapDot(page, taps - 1);
};

const lastHit = async (page: Page): Promise<string> =>
  (await page.$eval('.play', (el) => el.getAttribute('data-last-hit'))) ?? '';

/** The time of the last hit, from its sign. */
const hitTime = (sign: string): number => Number(sign.split(' ')[2] ?? Number.NaN);

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type Screen = { readonly width: number; readonly height: number };

/** True when the box is at least 44 px wide and inside the screen. */
const onScreen = (box: Box | null | undefined, screen: Screen): boolean =>
  box !== null &&
  box !== undefined &&
  box.width >= 44 &&
  box.x >= 0 &&
  box.y >= 0 &&
  box.x + box.width <= screen.width &&
  box.y + box.height <= screen.height;

const boxOf = async (page: Page, selector: string): Promise<Box | null | undefined> =>
  (await page.$(selector))?.boundingBox();

/** The play fills the screen, the pause button and Dot are on the screen, and nothing scrolls. */
const layoutFits = async (page: Page, name: string): Promise<void> => {
  const screen = page.viewport() ?? PORTRAIT;
  const canvas = await boxOf(page, '.play-stage');
  const pause = onScreen(await boxOf(page, '.pause-button'), screen);
  const dot = onScreen(await boxOf(page, '.play-pal[data-pal="dot"]'), screen);
  const still = await page.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight
  );
  check(`${name}: the stage fills the screen`, canvas?.width === screen.width && canvas.height === screen.height);
  check(`${name}: the pause button and Dot are on the screen`, pause && dot);
  check(`${name}: nothing scrolls`, still);
};

/** A hit in portrait and in landscape, and the layout in both. */
const hitsAndLayout = async (page: Page, shots: string | undefined): Promise<void> => {
  await tapDot(page, 20);
  const portraitHit = await lastHit(page);
  check('play: a tap in the lane hits', HIT_SIGN.test(portraitHit), portraitHit);
  await layoutFits(page, 'portrait');
  await shot(page, shots, 'play-portrait');
  await page.setViewport(LANDSCAPE);
  await wait(500);
  await layoutFits(page, 'landscape');
  await tapDot(page, 10);
  check('landscape: a tap in the lane hits', hitTime(await lastHit(page)) > hitTime(portraitHit));
  await shot(page, shots, 'play-landscape');
  await page.setViewport(PORTRAIT);
  await wait(300);
};

/** A short press on the pause button does nothing. A return from the background shows the pause screen, and the
 * play tap continues the song in a new audio context. */
const pauseAndReturn = async (page: Page, audio: AudioRecord): Promise<void> => {
  await touchHold(page, '.pause-button', 200);
  check('pause: a short press does not pause', (await page.$('.pause-screen')) === null);
  await page.evaluate(setVisibility, 'hidden');
  check('background: the play pauses', await shows(page, '.pause-screen', 1000));
  await page.evaluate(setVisibility, 'visible');
  await wait(300);
  const before = hitTime(await lastHit(page));
  audio.reset();
  await tap(page, '.pause-play');
  await wait(1000);
  const states = audio.contexts();
  check(
    'background trip: the play tap replaces the context',
    states.includes('closed') && states.includes('new'),
    states
  );
  check(
    'background trip: the song plays again',
    states.endsWith('running') && audio.sources() > 0,
    `${String(audio.sources())} sources`
  );
  await tapDot(page, 10);
  check('background trip: a tap hits again', hitTime(await lastHit(page)) > before);
};

/** The test song is in the list with a bronze record and 3 stars, and a tap starts it with running audio. The
 * context runs since the title tap, so it shows no change, or a change that ends in `running`. */
const startSong = async (page: Page, audio: AudioRecord, shots: string | undefined): Promise<boolean> => {
  await tap(page, '.title');
  check('song list: the test song shows', await shows(page, '.song-card'));
  check(
    'song list: a record and 3 stars',
    (await page.$$('.song-record')).length === 1 && (await page.$$('.song-stars svg')).length === 3
  );
  await shot(page, shots, 'songs-portrait');
  audio.reset();
  await tap(page, '.song-cover');
  const playing = await shows(page, '.play');
  await wait(2500);
  const states = audio.contexts();
  check('play: the play screen shows', playing);
  check(
    'play: the song plays',
    (states === '' || states.endsWith('running')) && audio.sources() > 0,
    `${states}, ${String(audio.sources())} sources`
  );
  return playing;
};

export const playChecks = async (page: Page, audio: AudioRecord, shots: string | undefined): Promise<void> => {
  if (!(await startSong(page, audio, shots))) {
    return;
  }
  await hitsAndLayout(page, shots);
  await pauseAndReturn(page, audio);
  await touchHold(page, '.pause-button', 800);
  check('pause: a hold of 0.6 s pauses', await shows(page, '.pause-screen', 1000));
  await shot(page, shots, 'pause-portrait');
  await touchHold(page, '.pause-home', 200);
  check('pause screen: a short press on home stays', (await page.$('.pause-screen')) !== null);
  await touchHold(page, '.pause-home', 800);
  check('pause screen: a hold on home goes to the song list', await shows(page, '.song-list', 2000));
  await tap(page, '.song-cover');
  check('second play: the play screen shows', await shows(page, '.play'));
  check('second play: the end of the song goes to the song list', await shows(page, '.song-list', SONG_END_MS));
};
