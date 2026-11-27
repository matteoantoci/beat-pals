// The time facts of the session model (./session.ts): the count of the play time, the day budget, the last start
// time of the evening, and the stage of the sun (play-sessions spec, "Session rules", changed by the session-schedule
// spec). The status line of the parent area (./status.ts) uses them too.

import { MINUTE_MS, SONG_ALLOWANCE_MS, SUN_STAGES } from './types';
import type { Open, PlayDay, SessionSettings, SunStage, Today } from './types';

/** One counted step over this time counts 0: the clock jumped forward. */
const MAX_STEP_MS = MINUTE_MS;

/**
 * Adds the counted time from `countingSince` to `now` to the session, and to the time used today when the parent did
 * not open the session. A negative step and a step over 60 s count 0.
 */
export const counted = (open: Open, now: number): Open => {
  if (open.countingSince === null) {
    return open;
  }
  const step = now - open.countingSince;
  const add = step >= 0 && step <= MAX_STEP_MS ? step : 0;
  const today = open.byParent ? open.today : { ...open.today, usedMs: open.today.usedMs + add };
  return { ...open, usedMs: open.usedMs + add, countingSince: now, today };
};

/** The time used in the play day `day`: 0 when `today` belongs to another play day. */
export const todayIn = (today: Today, day: PlayDay): Today =>
  today.start === day.start ? today : { start: day.start, usedMs: 0 };

/** The day budget that is left, in ms. */
export const budgetLeft = (today: Today, settings: SessionSettings): number =>
  settings.dayMinutes * MINUTE_MS - today.usedMs;

/** The last time of the play day when a session can start: the stop time minus the minutes of the settings. */
export const lastStartOf = (day: PlayDay, settings: SessionSettings): number => day.stop - settings.minutes * MINUTE_MS;

/**
 * The stage that the time used gives: sunset when the next song can reach the limit. For a session that the parent
 * did not open, also sunset when the next song can end after the stop time.
 */
export const stageOf = (open: Open, now: number, day: PlayDay): SunStage => {
  const late = !open.byParent && now + SONG_ALLOWANCE_MS > day.stop;
  if (open.usedMs + SONG_ALLOWANCE_MS > open.limitMs || open.usedMs >= open.limitMs || late) {
    return 'sunset';
  }
  return open.usedMs >= open.limitMs / 3 ? 'afternoon' : 'day';
};

/** The stage of the next list-open. The shown stage never goes back inside a session. */
export const nextStage = (open: Open, now: number, day: PlayDay): SunStage => {
  const stage = stageOf(open, now, day);
  return SUN_STAGES.indexOf(stage) > SUN_STAGES.indexOf(open.shownStage) ? stage : open.shownStage;
};
