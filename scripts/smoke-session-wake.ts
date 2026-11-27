// The step (b) of the play sessions in the smoke run (./smoke-session.ts): pals that sleep for 1 h more. A reload
// keeps the night title, a Reset in the parent area keeps the night, and "Open a new session now" and Done play the
// wake-up scene, and then the title shows with the play button. Also, after the rest time, a tap on the night title
// plays the wake-up scene.

import { check, shows, tap, wait } from './smoke-page.ts';
import { openParentArea } from './smoke-parent.ts';
import { asleepHour, asleepOver, seedSession, sessionOf } from './smoke-session-store.ts';
import type { Page } from 'puppeteer-core';

/** The wake-up scene lasts 5 s. */
const WAKE_MS = 5000;

/** Scrolls the element of the parent area into view and taps it. */
const tapInParent = async (page: Page, selector: string): Promise<void> => {
  await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center' })).catch(() => undefined);
  await wait(100);
  await tap(page, selector);
};

/** Done closes the parent area. */
const done = async (page: Page): Promise<void> => {
  await tap(page, '.parent-bar button');
  await wait(300);
};

/** A Reset in the parent area keeps the night title and the session state. */
const resetKeepsNight = async (page: Page): Promise<void> => {
  await tapInParent(page, '.reset-ask');
  await tapInParent(page, '.reset-confirm');
  await done(page);
  check('reset: the night title stays', (await page.$('.night-title')) !== null);
  check('reset: the session state stays', (await sessionOf(page)).kind === 'asleep');
};

/** The wake-up scene plays, and then the title shows with the play button. */
const wakeScene = async (page: Page, from: string): Promise<void> => {
  check(`${from}: the wake-up scene plays`, await shows(page, '.wake-up', 1000));
  check(`${from}: the night title is gone`, (await page.$('.night-title')) === null);
  check(
    `${from}: then the title shows with the play button`,
    await shows(page, 'main.title .title-play', WAKE_MS + 2000)
  );
  check(`${from}: the wake-up scene ends`, (await page.$('.wake-up')) === null);
};

/** After the rest time, a tap on the night title plays the wake-up scene. */
export const tapWake = async (page: Page, url: string): Promise<void> => {
  await seedSession(page, url, asleepOver(Date.now()));
  check('rest time over: the night title shows', await shows(page, '.night-title.night-first-light'));
  await tap(page, '.night-title');
  check('wake tap: the state is awake', (await sessionOf(page)).kind === 'awake');
  await wakeScene(page, 'wake tap');
};

/** (b) The night stays over a reload and a Reset, and "Open a new session now" wakes the pals. */
export const parentWake = async (page: Page, url: string): Promise<void> => {
  await seedSession(page, url, asleepHour(Date.now()));
  await page.reload({ waitUntil: 'networkidle2' });
  check('asleep: a reload shows the night title', await shows(page, '.night-title'));
  if (!(await openParentArea(page))) {
    return;
  }
  const first = await page.$('.parent-section');
  check(
    'parent area: "Play sessions" is the first section',
    (await first?.$eval('h2', (el) => el.textContent)) === 'Play sessions'
  );
  check(
    'parent area: the status gives the sleep with no clock time',
    /^Asleep for \d/u.test(await page.$eval('.play-sessions .parent-status', (el) => el.textContent))
  );
  check('parent area: "Open a new session now" shows while asleep', (await page.$('.play-sessions-open')) !== null);
  await resetKeepsNight(page);
  if (!(await openParentArea(page))) {
    return;
  }
  await tapInParent(page, '.play-sessions-open');
  check('open a new session: the state is awake', (await sessionOf(page)).kind === 'awake');
  check('open a new session: the button hides', (await page.$('.play-sessions-open')) === null);
  await done(page);
  await wakeScene(page, 'open a new session');
};
