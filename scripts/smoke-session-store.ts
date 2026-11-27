// The session state in the smoke run (scripts/smoke-session.ts): it reads the stored session state of the page, and
// writes the state that a step needs, or deletes it. The write happens on a static file of the same origin, where the
// app does not run, so the app cannot write its own state over it at the hide of the next load.

import type { Page } from 'puppeteer-core';

const SESSION_KEY = 'beat-pals:session';
const SETTINGS_KEY = 'beat-pals:session-settings';
const MINUTE_MS = 60_000;

/** The settings of the parent area: 10 minutes and 4 sessions per day. */
const SETTINGS = { minutes: 10, perDay: 4 };

/** The stored form of an open session (src/model/session/stored.ts). */
type SeedSession = {
  readonly version: number;
  readonly kind: 'open';
  readonly settings: typeof SETTINGS;
  readonly startedAt: number;
  readonly byParent: boolean;
  readonly usedMs: number;
  readonly shownStage: string;
  readonly countingSince: null;
  readonly hiddenAt: null;
  readonly lastSongAt: null;
  readonly starts: readonly number[];
};

/** The stored state of a session that opened 11 minutes ago and used its 10 minutes. */
export const usedUp = (now: number): SeedSession => ({
  version: 1,
  kind: 'open',
  settings: SETTINGS,
  startedAt: now - 11 * MINUTE_MS,
  byParent: false,
  usedMs: 10 * MINUTE_MS,
  shownStage: 'afternoon',
  countingSince: null,
  hiddenAt: null,
  lastSongAt: null,
  starts: [],
});

/** The fields of the stored session state that the steps read. A missing key gives no values. */
type Stored = {
  readonly kind: unknown;
  readonly usedMs: unknown;
  readonly startedAt: unknown;
  readonly hiddenAt: unknown;
  readonly lastSongAt: unknown;
};

/** The stored session state. Runs in the page. */
const storedSession = (key: string): Stored => {
  const raw = localStorage.getItem(key);
  const value: unknown = raw === null ? null : JSON.parse(raw);
  const fields = new Map<string, unknown>(typeof value === 'object' && value !== null ? Object.entries(value) : []);
  return {
    kind: fields.get('kind'),
    usedMs: fields.get('usedMs'),
    startedAt: fields.get('startedAt'),
    hiddenAt: fields.get('hiddenAt'),
    lastSongAt: fields.get('lastSongAt'),
  };
};

export const sessionOf = async (page: Page): Promise<Stored> => page.evaluate(storedSession, SESSION_KEY);

/**
 * Writes the session keys (null deletes them) from a static file of the same origin, where the app does not run,
 * and then starts the app again on its title screen.
 */
export const seedSession = async (page: Page, url: string, state: SeedSession | null): Promise<void> => {
  await page.goto(`${url}icon.svg`);
  await page.evaluate(
    (keys, seed) => {
      for (const key of keys) {
        localStorage.removeItem(key);
      }
      if (seed !== null) {
        localStorage.setItem(keys[0] ?? '', JSON.stringify(seed.state));
        localStorage.setItem(keys[1] ?? '', JSON.stringify(seed.settings));
      }
    },
    [SESSION_KEY, SETTINGS_KEY],
    state === null ? null : { state, settings: SETTINGS }
  );
  await page.goto(url, { waitUntil: 'networkidle2' });
};
