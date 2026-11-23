// The page helpers and the check list that all parts of the smoke run (scripts/smoke.ts) use.

import { join } from 'node:path';
import type { Page } from 'puppeteer-core';

type Point = { readonly x: number; readonly y: number };

const results: string[] = [];

/** Notes one check of the run. */
export const check = (name: string, pass: boolean, detail = ''): void => {
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

/** The checks so far, one line each. */
export const checkLines = (): readonly string[] => results;

export const wait = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

/** The centre of the element, or undefined when the element is not on the page. */
const centre = async (page: Page, selector: string): Promise<Point | undefined> => {
  const box = await (await page.$(selector))?.boundingBox();
  return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : undefined;
};

/**
 * A touch tap on the centre of the element. Gives false when the element is not on the page.
 * On iOS only a tap starts the audio, so the run uses touch, not the mouse.
 */
export const tap = async (page: Page, selector: string): Promise<boolean> => {
  const point = await centre(page, selector);
  if (point) {
    await page.touchscreen.tap(point.x, point.y);
  }
  return point !== undefined;
};

/** A touch on the centre of the element that stays down for `ms`. Gives false when the element is not on the page. */
export const touchHold = async (page: Page, selector: string, ms: number): Promise<boolean> => {
  const point = await centre(page, selector);
  if (point) {
    await page.touchscreen.touchStart(point.x, point.y);
    await wait(ms);
    await page.touchscreen.touchEnd();
  }
  return point !== undefined;
};

/** Waits up to `ms` for the element. Gives false when it does not show. */
export const shows = async (page: Page, selector: string, ms = 5000): Promise<boolean> =>
  page.waitForSelector(selector, { timeout: ms }).then(
    () => true,
    () => false
  );

/** Puts the page in the background or back to the front, as iOS does when the app hides. */
export const setVisibility = (state: string): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

/** Saves a screenshot `<name>.png` into the folder `shots`, when the run has one (SMOKE_SHOTS). */
export const shot = async (page: Page, shots: string | undefined, name: string): Promise<void> => {
  if (shots !== undefined) {
    await page.screenshot({ path: join(shots, `${name}.png`) });
  }
};
