// The stored form of the session state and of the session settings (spec "Play sessions", section "Storage"). They
// have their own localStorage keys, not the save, so the save code and the reset of the parent area do not touch them.
// The restore checks the shape and never throws.

import { sessionAfter } from './session';
import { DAY_MS, DEFAULT_SESSION_SETTINGS, SONG_ALLOWANCE_MS } from './types';
import type { SessionEvent, SessionSettings, SessionState, SunStage } from './types';

/**
 * The schema version of the stored session state. A state with another version gives the awake state.
 * Raise this number when `restoreSession` cannot read the data of the older version.
 */
const SESSION_VERSION = 1;

type StoredSession = SessionState & { readonly version: number };

const AWAKE: SessionState = { kind: 'awake', starts: [], byParent: false };

const MINUTES: ReadonlySet<unknown> = new Set([5, 10, 15, 20, 25, 30]);
const PER_DAY: ReadonlySet<unknown> = new Set([1, 2, 3, 4, 5, 6]);
const STAGES: ReadonlySet<unknown> = new Set(['day', 'afternoon', 'sunset']);

const isMinutes = (value: unknown): value is SessionSettings['minutes'] => MINUTES.has(value);
const isPerDay = (value: unknown): value is SessionSettings['perDay'] => PER_DAY.has(value);
const isStage = (value: unknown): value is SunStage => STAGES.has(value);
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isTimeOrNull = (value: unknown): value is number | null => value === null || isTime(value);

/** The fields of a plain object, or undefined for any other value. */
const fieldsOf = (value: unknown): ReadonlyMap<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? new Map(Object.entries(value)) : undefined;

const startsOf = (value: unknown): readonly number[] | undefined =>
  Array.isArray(value) && value.every(isTime) ? value : undefined;

/** The settings, or undefined when a field is out of its range. */
const settingsOf = (value: unknown): SessionSettings | undefined => {
  const fields = fieldsOf(value);
  const minutes = fields?.get('minutes');
  const perDay = fields?.get('perDay');
  return isMinutes(minutes) && isPerDay(perDay) ? { minutes, perDay } : undefined;
};

/** The open state of the stored fields, with no count, or undefined when the shape is wrong. */
const openOf = (fields: ReadonlyMap<string, unknown>, starts: readonly number[]): SessionState | undefined => {
  const settings = settingsOf(fields.get('settings'));
  const startedAt = fields.get('startedAt');
  const byParent = fields.get('byParent');
  const usedMs = fields.get('usedMs');
  const shownStage = fields.get('shownStage');
  const hiddenAt = fields.get('hiddenAt');
  const lastSongAt = fields.get('lastSongAt');
  const valid =
    settings !== undefined &&
    isTime(startedAt) &&
    typeof byParent === 'boolean' &&
    isTime(usedMs) &&
    usedMs >= 0 &&
    isStage(shownStage) &&
    isTimeOrNull(hiddenAt) &&
    isTimeOrNull(lastSongAt);
  return valid
    ? {
        kind: 'open',
        settings,
        startedAt,
        byParent,
        usedMs,
        shownStage,
        countingSince: null,
        hiddenAt,
        lastSongAt,
        starts,
      }
    : undefined;
};

/** The session state of the stored data, or undefined when the version or the shape is wrong. */
const stateOf = (stored: unknown): SessionState | undefined => {
  const fields = fieldsOf(stored);
  const starts = startsOf(fields?.get('starts'));
  if (fields === undefined || fields.get('version') !== SESSION_VERSION || starts === undefined) {
    return undefined;
  }
  const byParent = fields.get('byParent');
  const until = fields.get('until');
  switch (fields.get('kind')) {
    case 'awake':
      return typeof byParent === 'boolean' ? { kind: 'awake', starts, byParent } : undefined;
    case 'asleep':
      return isTime(until) ? { kind: 'asleep', until, starts } : undefined;
    case 'open':
      return openOf(fields, starts);
    default:
      return undefined;
  }
};

/** The data to write to localStorage. It is plain JSON. */
export const storedSession = (state: SessionState): StoredSession => ({ version: SESSION_VERSION, ...state });

/**
 * Reads the stored session state at the start of the app, at `now`. It never throws: a damaged or old state gives
 * the awake state. For a clock that went back, a stored time later than `now` counts as `now`. Also, an asleep-until
 * more than 24 h after `now` is cut to `now` plus 24 h. An open session does not count until the next count-start, so
 * the gap is never play time. A record of the last song gives the asleep state. Its goodbye is at the start of the
 * last song plus L, but not later than `now`. Else the gap rule applies with the stored time of the hide.
 */
export const restoreSession = (stored: unknown, now: number): SessionState => {
  const state = stateOf(stored);
  if (state === undefined) {
    return AWAKE;
  }
  const notLater = (time: number): number => Math.min(time, now);
  const starts = state.starts.map(notLater);
  if (state.kind === 'awake') {
    return { ...state, starts };
  }
  if (state.kind === 'asleep') {
    return { ...state, until: Math.min(state.until, now + DAY_MS), starts };
  }
  const { hiddenAt, lastSongAt } = state;
  const open: SessionState = {
    ...state,
    startedAt: notLater(state.startedAt),
    hiddenAt: hiddenAt === null ? null : notLater(hiddenAt),
    lastSongAt: lastSongAt === null ? null : notLater(lastSongAt),
    starts,
  };
  const event: SessionEvent =
    open.lastSongAt === null
      ? { type: 'show', now }
      : { type: 'goodbye', now: notLater(open.lastSongAt + SONG_ALLOWANCE_MS) };
  return sessionAfter(open, event).state;
};

/** Reads the stored settings. It never throws: a missing or damaged field gives its default. */
export const restoreSessionSettings = (stored: unknown): SessionSettings => {
  const fields = fieldsOf(stored);
  const minutes = fields?.get('minutes');
  const perDay = fields?.get('perDay');
  return {
    minutes: isMinutes(minutes) ? minutes : DEFAULT_SESSION_SETTINGS.minutes,
    perDay: isPerDay(perDay) ? perDay : DEFAULT_SESSION_SETTINGS.perDay,
  };
};
