// The end-scene part of the smoke run (scripts/smoke-play.ts): after the song ends, the end scene shows. A tap in
// its first 2 s does nothing, one tap after 2 s skips to the final state with no press of the button, and the
// button goes back to the song list. The song list then shows the saved record and stars.

import { check, shot, shows, tap, wait } from './smoke-page.ts';
import type { Page } from 'puppeteer-core';

/** The end scene ignores taps for this long. */
const DEAF_MS = 2000;
/** The shortest end scene lasts 3 s, so a skip after 2.2 s shows the button before the scene ends by itself. */
const SKIP_AT_MS = 2200;

const hasButton = async (page: Page): Promise<boolean> => (await page.$('.end-done')) !== null;

/** Waits for the end scene for up to `ms`. Then it checks the taps of the scene and goes back to the song list. */
export const endScene = async (page: Page, ms: number, shots: string | undefined): Promise<void> => {
  const shown = await shows(page, '.end', ms);
  const shownAt = Date.now();
  check('end of the song: the end scene shows', shown);
  if (!shown) {
    return;
  }
  await tap(page, '.end-stage');
  await wait(300);
  check('end scene: a tap in the first 2 s does nothing', !(await hasButton(page)));
  await shot(page, shots, 'end-portrait');
  await wait(Math.max(0, SKIP_AT_MS - (Date.now() - shownAt)));
  // The skip tap lands where the button shows, so a press of the button would leave the scene.
  await tap(page, '.end-foot');
  const skippedAt = Date.now() - shownAt;
  check(
    'end scene: one tap after 2 s skips to the button',
    (await shows(page, '.end-done', 500)) && skippedAt >= DEAF_MS,
    `${String(skippedAt)} ms`
  );
  await wait(500);
  check('end scene: the skip tap does not press the button', (await page.$('.end')) !== null);
  await tap(page, '.end-done');
  check('end scene: the button goes back to the song list', await shows(page, '.song-list', 2000));
  // The smoke play hits no note, so the save holds one weak play of the test song.
  const save = await page.evaluate(() => localStorage.getItem('beat-pals:save') ?? '');
  check(
    'end of the song: the save holds one weak play',
    /^\{"version":1,"progress":\{"[a-z0-9-]+":\{"color":0,"stars":0,"weakPlays":1\}\}\}$/u.test(save),
    save
  );
  // A weak play keeps level 0, so the card shows the empty shelf again: the empty record and 3 empty stars.
  check(
    'song list: the empty shelf of level 0 after a weak play',
    (await shows(page, '.song-card', 2000)) &&
      (await page.$$('.song-record[role="img"]')).length === 0 &&
      (await page.$$('.song-stars[aria-label="0 stars"]')).length === 1
  );
};
