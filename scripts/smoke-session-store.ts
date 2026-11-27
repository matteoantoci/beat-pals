// The session state in the smoke run (scripts/smoke-session.ts): it reads the stored session state of the page, and
// writes the state that a step needs, or deletes it. The write happens on a static file of the same origin, where the
// app does not run, so the app cannot write its own state over it at the hide of the next load.
// The session rules use the clock time (session-schedule spec: the day start at 5:00 and the stop time), so the pages
// of the smoke run get a clock that starts at 10:00 of the local date (`daytimeClock`). A seed takes the time of the
// page.

import type { Page } from 'puppeteer-core';

const SESSION_KEY = 'beat-pals:session';
const SETTINGS_KEY = 'beat-pals:session-settings';
const MINUTE_MS = 60_000;
/** The version of the stored session state and of the stored settings (src/model/session/stored.ts). */
const VERSION = 2;

/** The settings of the parent area: 10 minutes, 45 minutes a day, a rest time of 1 h, and a stop at 20:00. */
const SETTINGS = { minutes: 10, dayMinutes: 45, restMinutes: 60, stopMinutes: 1200 };

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

/** The time used in a play day (src/model/session/types.ts). */
type Today = { readonly start: number; readonly usedMs: number };

/** The time used in the play day of `now`. The clock of the page is after 10:00, so the day start is 5:00 of its date. */
const todayOf = (now: number, usedMs: number): Today => {
  const start = new Date(now);
  start.setHours(5, 0, 0, 0);
  return { start: start.getTime(), usedMs };
};

/** The stored form of an open session (src/model/session/stored.ts). */
type SeedOpen = {
  readonly version: number;
  readonly kind: 'open';
  readonly settings: typeof SETTINGS;
  readonly limitMs: number;
  readonly byParent: boolean;
  readonly usedMs: number;
  readonly shownStage: string;
  readonly countingSince: null;
  readonly hiddenAt: null;
  readonly lastSongAt: null;
  readonly today: Today;
};

/** The stored form of an asleep state (src/model/session/stored.ts). */
type SeedAsleep = { readonly version: number; readonly kind: 'asleep'; readonly until: number; readonly today: Today };

/** The stored form of an awake state (src/model/session/stored.ts). */
type SeedAwake = {
  readonly version: number;
  readonly kind: 'awake';
  readonly today: Today;
  readonly byParent: boolean;
};

type Seed = SeedOpen | SeedAsleep | SeedAwake;

/** The stored state of pals that sleep for 1 h more. */
export const asleepHour = (now: number): SeedAsleep => ({
  version: VERSION,
  kind: 'asleep',
  until: now + 60 * MINUTE_MS,
  today: todayOf(now, 10 * MINUTE_MS),
});

/** The stored state of pals whose rest time ended 1 minute ago. */
export const asleepOver = (now: number): SeedAsleep => ({
  version: VERSION,
  kind: 'asleep',
  until: now - MINUTE_MS,
  today: todayOf(now, 10 * MINUTE_MS),
});

/** The stored state of a session that used its 10 minutes. */
export const usedUp = (now: number): SeedOpen => ({
  version: VERSION,
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

/** The stored state of awake pals with the day budget of 45 minutes used. */
export const budgetUsed = (now: number): SeedAwake => ({
  version: VERSION,
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

export const sessionOf = async (page: Page): Promise<Stored> => page.evaluate(readStoredState, SESSION_KEY);

/**
 * Writes the session keys (null deletes them) from a static file of the same origin, where the app does not run,
 * and then starts the app again on its title screen. `seed` gives the state at the time of the page.
 */
export const seedSession = async (page: Page, url: string, seed: ((now: number) => Seed) | null): Promise<void> => {
  await page.goto(`${url}icon.svg`);
  const now = await page.evaluate(() => Date.now());
  await page.evaluate(
    (keys, stored) => {
      for (const key of keys) {
        localStorage.removeItem(key);
      }
      if (stored !== null) {
        localStorage.setItem(keys[0] ?? '', JSON.stringify(stored.state));
        localStorage.setItem(keys[1] ?? '', JSON.stringify(stored.settings));
      }
    },
    [SESSION_KEY, SETTINGS_KEY],
    seed === null ? null : { state: seed(now), settings: { version: VERSION, ...SETTINGS } }
  );
  await page.goto(url, { waitUntil: 'networkidle2' });
};
