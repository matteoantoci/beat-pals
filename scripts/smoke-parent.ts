// The parent part of the smoke run (scripts/smoke.ts): the parent check from the logo hold, and the song setup in
// the "Songs" section with the key code of the test store. The key code goes into the field only; it is never
// printed.

import { check, shows, tap, wait } from './smoke-page.ts';
import type { Page } from 'puppeteer-core';

/** The download of the one short test song ends well within this time. */
const DOWNLOAD_MS = 20_000;

/** Taps the digits on the pad of the parent check, one after the other. Digit 0 is button 11 of the pad. */
const typeDigits = async (page: Page, digits: string): Promise<void> => {
  const [digit] = digits;
  if (digit === undefined) {
    return;
  }
  await tap(page, `.parent-pad button:nth-child(${digit === '0' ? '11' : digit})`);
  await wait(150);
  await typeDigits(page, digits.slice(1));
};

/** A press of 3.2 s on the logo opens the parent check. The right answer opens the parent area. */
const openParentArea = async (page: Page): Promise<boolean> => {
  const box = await (await page.$('.logo'))?.boundingBox();
  if (!box) {
    check('parent check: logo shows', false);
    return false;
  }
  await page.touchscreen.touchStart(box.x + box.width / 2, box.y + box.height / 2);
  await wait(3200);
  await page.touchscreen.touchEnd();
  check('logo hold: parent check shows', (await page.$('.parent-check')) !== null);
  const answer = await page.$eval('.parent-problem', (el) => {
    const [left = 0, right = 0] = (el.textContent.match(/\d+/gu) ?? []).map(Number);
    return String(left * right);
  });
  await wait(300);
  check(
    'hold release: answer field is empty',
    (await page.$eval('.parent-problem output', (el) => el.textContent)) === '?'
  );
  await typeDigits(page, answer);
  await tap(page, '.parent-ok');
  await wait(300);
  const open = (await page.$('.parent-area')) !== null;
  check('right answer: parent area shows', open);
  return open;
};

/** The key step takes the test key, and the download step downloads the test song. */
const songSetup = async (page: Page, keyCode: string): Promise<void> => {
  await page.type('#song-key', keyCode);
  await tap(page, '.song-key-check');
  check('song setup: the test key opens the store', await shows(page, '.song-key-ok'));
  check('song setup: the download step shows', await shows(page, '.song-download'));
  await tap(page, '.song-download');
  check('song setup: the test song downloads', await shows(page, '.song-ready', DOWNLOAD_MS));
};

/** Opens the parent area, sets up the songs, and goes back to the title screen with Done. */
export const parentArea = async (page: Page, keyCode: string): Promise<void> => {
  if (!(await openParentArea(page))) {
    return;
  }
  await songSetup(page, keyCode);
  await tap(page, '.parent-bar button');
  await wait(300);
  check('Done: title screen shows', (await page.$('.title .logo')) !== null);
};
