// The session state in the smoke run (scripts/smoke-session.ts): it reads the stored session state of the page, and
// writes the state that a step needs, or deletes it. The write happens on a static file of the same origin, where the
// app does not run, so the app cannot write its own state over it at the hide of the next load.
// The session rules use the clock time (session-schedule spec: the day start at 5:00 and the stop time), so the pages
// of the smoke run get a clock that starts at 10:00 of the local date (`daytimeClock`). A seed takes the time of the
// page. A seed is a session state of the model, and the model gives its stored form.

import { STORAGE_KEYS } from '../src/shell/storage/keys.ts';
import type { SessionSettings, SessionState, Today } from '../src/model/index.ts';
import type { Page } from 'puppeteer-core';

const MINUTE_MS = 60_000;

/** The settings of the parent area: 10 minutes, 45 minutes a day, a rest time of 1 h, and a stop at 20:00. */
const SETTINGS: SessionSettings = { minutes: 10, dayMinutes: 45, restMinutes: 60, stopMinutes: 1200 };

/**
 * Runs in the page before its scripts: `Date.now` starts at 10:00 of the local date and then moves on, so the stop
 * time and the day start never stop a session step, at any hour of the smoke run.
 */
export const daytimeClock = (): void => {
  const real = Date.now.bind(Date);
  const start = real();
  const morning = new Date(start);
  morning.setHours(10, 0, 0, 0);
  const offset = morning.getTime() - start;
  Date.now = () => real() + offset;
};

/** The time used in the play day of `now`. The clock of the page is after 10:00, so the day start is 5:00 of its date. */
const todayOf = (now: number, usedMs: number): Today => {
  const start = new Date(now);
  start.setHours(5, 0, 0, 0);
  return { start: start.getTime(), usedMs };
};

/** Pals that sleep for 1 h more. */
export const asleepHour = (now: number): SessionState => ({
  kind: 'asleep',
  until: now + 60 * MINUTE_MS,
  today: todayOf(now, 10 * MINUTE_MS),
});

/** Pals whose rest time ended 1 minute ago. */
export const asleepOver = (now: number): SessionState => ({
  kind: 'asleep',
  until: now - MINUTE_MS,
  today: todayOf(now, 10 * MINUTE_MS),
});

/** A session that used its 10 minutes. */
export const usedUp = (now: number): SessionState => ({
  kind: 'open',
  settings: SETTINGS,
  limitMs: 10 * MINUTE_MS,
  byParent: false,
  usedMs: 10 * MINUTE_MS,
  shownStage: 'afternoon',
  countingSince: null,
  hiddenAt: null,
  lastSongAt: null,
  today: todayOf(now, 10 * MINUTE_MS),
});

/** Awake pals with the day budget of 45 minutes used. */
export const budgetUsed = (now: number): SessionState => ({
  kind: 'awake',
  today: todayOf(now, 45 * MINUTE_MS),
  byParent: false,
});

/** The fields of the stored session state that the steps read. A missing key gives no values. */
type Stored = {
  readonly kind: unknown;
  readonly usedMs: unknown;
  readonly hiddenAt: unknown;
  readonly lastSongAt: unknown;
};

/** Reads the stored session state from localStorage. Runs in the page. */
const readStoredState = (key: string): Stored => {
  const raw = localStorage.getItem(key);
  const value: unknown = raw === null ? null : JSON.parse(raw);
  const fields = new Map<string, unknown>(typeof value === 'object' && value !== null ? Object.entries(value) : []);
  return {
    kind: fields.get('kind'),
    usedMs: fields.get('usedMs'),
    hiddenAt: fields.get('hiddenAt'),
    lastSongAt: fields.get('lastSongAt'),
  };
};

export const sessionOf = async (page: Page): Promise<Stored> => page.evaluate(readStoredState, STORAGE_KEYS.session);

/** The stored texts of the session state and of the settings, in the stored form of the model. */
const storedTexts = async (state: SessionState): Promise<readonly [string, string]> => {
  // smoke.ts imports this file before it sets the resolve hook for the game model, so the model loads here, in the run.
  const { storedSession, storedSessionSettings } = await import('../src/model/index.ts');
  return [JSON.stringify(storedSession(state)), JSON.stringify(storedSessionSettings(SETTINGS))];
};

/**
 * Writes the session keys (null deletes them) from a static file of the same origin, where the app does not run,
 * and then starts the app again on its title screen. `seed` gives the state at the time of the page.
 */
export const seedSession = async (
  page: Page,
  url: string,
  seed: ((now: number) => SessionState) | null
): Promise<void> => {
  await page.goto(`${url}icon.svg`);
  const now = await page.evaluate(() => Date.now());
  await page.evaluate(
    (keys, texts) => {
      for (const key of keys) {
        localStorage.removeItem(key);
      }
      if (texts !== null) {
        localStorage.setItem(keys[0], texts[0]);
        localStorage.setItem(keys[1], texts[1]);
      }
    },
    [STORAGE_KEYS.session, STORAGE_KEYS.sessionSettings] as const,
    seed === null ? null : await storedTexts(seed(now))
  );
  await page.goto(url, { waitUntil: 'networkidle2' });
};
