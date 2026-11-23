// The parent area in the smoke run (scripts/smoke.ts): the parent check from the logo hold, and Done. The song setup
// in its "Songs" section is in scripts/smoke-setup.ts.

import { check, tap, wait } from './smoke-page.ts';
import type { Page } from 'puppeteer-core';

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
export const openParentArea = async (page: Page): Promise<boolean> => {
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

/** Done closes the parent area and shows the title screen. */
export const closeParentArea = async (page: Page, name: string): Promise<void> => {
  await tap(page, '.parent-bar button');
  await wait(300);
  check(`${name}: Done shows the title screen`, (await page.$('.title .logo')) !== null);
};
