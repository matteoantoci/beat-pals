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

const SAVE = 'beat-pals:save';
const SOUND = 'beat-pals:sound';
/** The chart author of the test song (scripts/smoke-store.ts). */
const TEST_CHARTER = 'Smoke Run';

/** Scrolls the element into the middle of the parent area and taps it. */
const tapIn = async (page: Page, selector: string): Promise<boolean> => {
  await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center' })).catch(() => undefined);
  await wait(100);
  return tap(page, selector);
};

const stored = async (page: Page, key: string): Promise<string | null> =>
  page.evaluate((name) => localStorage.getItem(name), key);

const textOf = async (page: Page, selector: string): Promise<string> =>
  page.$eval(selector, (el) => el.textContent).catch(() => '');

/** True when IndexedDB holds the family key. Runs in the page. */
const hasFamilyKey = async (): Promise<boolean> => {
  const open = indexedDB.open('beat-pals');
  const opened = Promise.withResolvers<IDBDatabase>();
  open.addEventListener('success', () => opened.resolve(open.result));
  open.addEventListener('error', () => opened.reject(open.error ?? new Error('IndexedDB failed.')));
  const database = await opened.promise;
  const read = database.transaction('keys').objectStore('keys').count('family');
  const counted = Promise.withResolvers<number>();
  read.addEventListener('success', () => counted.resolve(read.result));
  read.addEventListener('error', () => counted.reject(read.error ?? new Error('IndexedDB failed.')));
  const count = await counted.promise;
  database.close();
  return count === 1;
};

/** The Sound effects switch turns off and on, and keeps its setting in `beat-pals:sound`. */
const soundSwitch = async (page: Page): Promise<void> => {
  const state = async (): Promise<string> =>
    page.$eval('.parent-switch', (el) => el.getAttribute('aria-checked') ?? '');
  check('parent area: Sound effects is on by default', (await state()) === 'true');
  await tapIn(page, '.parent-switch');
  check('Sound effects: a tap turns it off', (await state()) === 'false' && (await stored(page, SOUND)) === 'off');
  await tapIn(page, '.parent-switch');
  check('Sound effects: a second tap turns it on', (await state()) === 'true' && (await stored(page, SOUND)) === 'on');
};

/** The credits name the title music and the chart author of the ready test song. */
const credits = async (page: Page): Promise<void> => {
  const text = await textOf(page, '.credits-section');
  check(
    'credits: the title music and its author',
    text.includes('Happy Adventure (Loop)') && text.includes('TinyWorlds')
  );
  const shown = await page.waitForSelector('.chart-authors li', { timeout: 5000 }).then(
    () => true,
    () => false
  );
  const authors = shown ? await textOf(page, '.chart-authors') : '';
  check('credits: the chart author of the ready song', authors === TEST_CHARTER, authors);
};

/** Makes the save code of the progress and gives it back. */
const makeCode = async (page: Page): Promise<string> => {
  check('save code: the note', (await textOf(page, '.save-code-note')) === 'This code lists the songs on this device.');
  await tapIn(page, '.save-make');
  await wait(300);
  const code = await page.$eval('.save-new textarea', (el) => el.value).catch(() => '');
  check('save code: a code shows', /^[\w-]{20,}$/u.test(code), `${String(code.length)} characters`);
  return code;
};

/** Reset with a confirmation deletes the progress. The settings, the songs, and the family key stay. */
const reset = async (page: Page): Promise<void> => {
  await tapIn(page, '.reset-ask');
  check(
    'reset: the first tap only asks',
    (await stored(page, SAVE)) !== null && (await page.$('.reset-confirm')) !== null
  );
  await tapIn(page, '.reset-confirm');
  await wait(200);
  check('reset: the progress is deleted', (await stored(page, SAVE)) === null);
  check('reset: the Sound effects setting stays', (await stored(page, SOUND)) === 'on');
  const songs = await page.evaluate(async () => (await (await caches.open('beat-pals-songs')).keys()).length);
  check('reset: the songs stay', songs > 0, `${String(songs)} cached files`);
  check('reset: the family key stays', await page.evaluate(hasFamilyKey));
};

/** A wrong code is refused. The code from before the reset gives the same save back. */
const restoreCode = async (page: Page, code: string, before: string | null): Promise<void> => {
  await page.type('.save-restore textarea', 'hello');
  await tapIn(page, '.save-restore-button');
  await wait(300);
  check(
    'restore: a wrong code is refused',
    (await textOf(page, '.save-restore .parent-note')).startsWith('This is not')
  );
  await page.$eval('.save-restore textarea', (el) => {
    el.focus();
    el.select();
  });
  await page.keyboard.press('Backspace');
  await page.type('.save-restore textarea', code);
  await tapIn(page, '.save-restore-button');
  await wait(500);
  const after = await stored(page, SAVE);
  check('restore: the save code gives the progress back', after !== null && after === before, after ?? 'no save');
};

/** From the song list: the new sections of the parent area (the last load problem, the sound switch, the save
 * code, reset, credits). The failed load of scripts/smoke-load.ts comes before. */
export const parentSections = async (page: Page): Promise<void> => {
  await tap(page, '.song-home');
  await wait(300);
  if (!(await openParentArea(page))) {
    return;
  }
  check(
    'parent area: the last load problem shows',
    (await textOf(page, '.song-load-problem')).includes('a song file was missing')
  );
  const before = await stored(page, SAVE);
  await soundSwitch(page);
  await credits(page);
  const code = await makeCode(page);
  await reset(page);
  await restoreCode(page, code, before);
  await closeParentArea(page, 'parent sections');
};
