// The stored form of the session state and of the session settings (play-sessions spec, section "Storage", changed
// by the session-schedule spec). They have their own localStorage keys, not the save, so the save code and the reset
// of the parent area do not touch them. The restore checks the shape and never throws.

import { sessionAfter } from './session';
import {
  DAY_MINUTES,
  DAY_MS,
  DEFAULT_SESSION_SETTINGS,
  REST_MINUTES,
  SESSION_MINUTES,
  SONG_ALLOWANCE_MS,
  STOP_MINUTES,
  SUN_STAGES,
} from './types';
import type { PlayDay, SessionEvent, SessionSettings, SessionState, SunStage, Today } from './types';

/**
 * The schema version of the stored session state. Version 1 had the even spacing and the rolling cap: its asleep
 * state keeps its asleep-until, and any other state of it gives the awake state. Any other version gives the awake
 * state. Raise this number when `restoreSession` cannot read the data of the older version.
 */
const SESSION_VERSION = 2;

/** The schema version of the stored settings. The settings of version 1 had no version field. */
const SETTINGS_VERSION = 2;

type StoredSession = SessionState & { readonly version: number };

type StoredSettings = SessionSettings & { readonly version: number };

const MINUTES: ReadonlySet<unknown> = new Set(SESSION_MINUTES);
const DAY_BUDGET: ReadonlySet<unknown> = new Set(DAY_MINUTES);
const REST: ReadonlySet<unknown> = new Set(REST_MINUTES);
const STOP: ReadonlySet<unknown> = new Set(STOP_MINUTES);
const STAGES: ReadonlySet<unknown> = new Set(SUN_STAGES);

const isMinutes = (value: unknown): value is SessionSettings['minutes'] => MINUTES.has(value);
const isDayMinutes = (value: unknown): value is SessionSettings['dayMinutes'] => DAY_BUDGET.has(value);
const isRest = (value: unknown): value is SessionSettings['restMinutes'] => REST.has(value);
const isStop = (value: unknown): value is SessionSettings['stopMinutes'] => STOP.has(value);
const isStage = (value: unknown): value is SunStage => STAGES.has(value);
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isTimeOrNull = (value: unknown): value is number | null => value === null || isTime(value);

/** The fields of a plain object, or undefined for any other value. */
const fieldsOf = (value: unknown): ReadonlyMap<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? new Map(Object.entries(value)) : undefined;

/** The time used in a play day, or undefined when the shape is wrong. */
const todayOf = (value: unknown): Today | undefined => {
  const fields = fieldsOf(value);
  const start = fields?.get('start');
  const usedMs = fields?.get('usedMs');
  return isTime(start) && isTime(usedMs) && usedMs >= 0 ? { start, usedMs } : undefined;
};

/** The settings of an open session, or undefined when a field is out of its range. */
const settingsOf = (value: unknown): SessionSettings | undefined => {
  const fields = fieldsOf(value);
  const minutes = fields?.get('minutes');
  const dayMinutes = fields?.get('dayMinutes');
  const restMinutes = fields?.get('restMinutes');
  const stopMinutes = fields?.get('stopMinutes');
  return isMinutes(minutes) && isDayMinutes(dayMinutes) && isRest(restMinutes) && isStop(stopMinutes)
    ? { minutes, dayMinutes, restMinutes, stopMinutes }
    : undefined;
};

/** The open state of the stored fields, with no count, or undefined when the shape is wrong. */
const openOf = (fields: ReadonlyMap<string, unknown>, today: Today): SessionState | undefined => {
  const settings = settingsOf(fields.get('settings'));
  const limitMs = fields.get('limitMs');
  const byParent = fields.get('byParent');
  const usedMs = fields.get('usedMs');
  const shownStage = fields.get('shownStage');
  const hiddenAt = fields.get('hiddenAt');
  const lastSongAt = fields.get('lastSongAt');
  const valid =
    settings !== undefined &&
    isTime(limitMs) &&
    limitMs > 0 &&
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
        limitMs,
        byParent,
        usedMs,
        shownStage,
        countingSince: null,
        hiddenAt,
        lastSongAt,
        today,
      }
    : undefined;
};

/** The state of version 1: its asleep state with 0 used today, or else undefined (the awake state). */
const version1Of = (fields: ReadonlyMap<string, unknown>, fresh: Today): SessionState | undefined => {
  const until = fields.get('until');
  return fields.get('kind') === 'asleep' && isTime(until) ? { kind: 'asleep', until, today: fresh } : undefined;
};

/** The state of the current version, or undefined when the shape is wrong. */
const currentOf = (fields: ReadonlyMap<string, unknown>): SessionState | undefined => {
  const today = todayOf(fields.get('today'));
  if (today === undefined) {
    return undefined;
  }
  const byParent = fields.get('byParent');
  const until = fields.get('until');
  switch (fields.get('kind')) {
    case 'awake':
      return typeof byParent === 'boolean' ? { kind: 'awake', today, byParent } : undefined;
    case 'asleep':
      return isTime(until) ? { kind: 'asleep', until, today } : undefined;
    case 'open':
      return openOf(fields, today);
    default:
      return undefined;
  }
};

/** The session state of the stored data, or undefined when the version or the shape is wrong. */
const stateOf = (stored: unknown, fresh: Today): SessionState | undefined => {
  const fields = fieldsOf(stored);
  if (fields === undefined) {
    return undefined;
  }
  switch (fields.get('version')) {
    case 1:
      return version1Of(fields, fresh);
    case SESSION_VERSION:
      return currentOf(fields);
    default:
      return undefined;
  }
};

/** The data to write to localStorage. It is plain JSON. */
export const storedSession = (state: SessionState): StoredSession => ({ version: SESSION_VERSION, ...state });

/**
 * Reads the stored session state at the start of the app, at `now` in the play day `day`. It never throws: a damaged
 * or unknown state gives the awake state. The time used of an earlier play day gives 0 used. For a clock that went
 * back, a stored time later than `now` counts as `now`, and an asleep-until more than 24 h after `now` is cut to
 * `now` plus 24 h. An open session does not count until the next count-start, so the gap is never play time. A
 * record of the last song gives the asleep state. Its goodbye is at the start of the last song plus L, but not later
 * than `now`. Else the gap rule applies with the stored time of the hide.
 */
export const restoreSession = (stored: unknown, now: number, day: PlayDay): SessionState => {
  const fresh: Today = { start: day.start, usedMs: 0 };
  const state = stateOf(stored, fresh);
  if (state === undefined) {
    return { kind: 'awake', today: fresh, byParent: false };
  }
  const today = state.today.start === day.start ? state.today : fresh;
  if (state.kind === 'awake') {
    return { ...state, today };
  }
  if (state.kind === 'asleep') {
    return { ...state, until: Math.min(state.until, now + DAY_MS), today };
  }
  const notLater = (time: number): number => Math.min(time, now);
  const { hiddenAt, lastSongAt } = state;
  const open: SessionState = {
    ...state,
    hiddenAt: hiddenAt === null ? null : notLater(hiddenAt),
    lastSongAt: lastSongAt === null ? null : notLater(lastSongAt),
  };
  const event: SessionEvent =
    open.lastSongAt === null
      ? { type: 'show', now, day }
      : { type: 'goodbye', now: notLater(open.lastSongAt + SONG_ALLOWANCE_MS), day };
  return sessionAfter(open, event).state;
};

/** The data of the settings to write to localStorage. It is plain JSON. */
export const storedSessionSettings = (settings: SessionSettings): StoredSettings => ({
  version: SETTINGS_VERSION,
  ...settings,
});

/**
 * Reads the stored settings. It never throws: a missing or damaged field gives its default. The settings of version 1
 * give the defaults, because their sessions per day meant the even spacing.
 */
export const restoreSessionSettings = (stored: unknown): SessionSettings => {
  const fields = fieldsOf(stored);
  if (fields?.get('version') !== SETTINGS_VERSION) {
    return DEFAULT_SESSION_SETTINGS;
  }
  const minutes = fields.get('minutes');
  const dayMinutes = fields.get('dayMinutes');
  const restMinutes = fields.get('restMinutes');
  const stopMinutes = fields.get('stopMinutes');
  return {
    minutes: isMinutes(minutes) ? minutes : DEFAULT_SESSION_SETTINGS.minutes,
    dayMinutes: isDayMinutes(dayMinutes) ? dayMinutes : DEFAULT_SESSION_SETTINGS.dayMinutes,
    restMinutes: isRest(restMinutes) ? restMinutes : DEFAULT_SESSION_SETTINGS.restMinutes,
    stopMinutes: isStop(stopMinutes) ? stopMinutes : DEFAULT_SESSION_SETTINGS.stopMinutes,
  };
};
