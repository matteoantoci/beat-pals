import { DAY_START_MINUTES } from '../model';
import type { PlayDay } from '../model';

// The play day of a wall time (session-schedule spec, "The play day"), from the local calendar of the device. The
// session model never reads the local time, so the shell gives it the play day. A day start is at 5:00 local time.
// From 0:00 to 5:00 the play day is the day before. A day with a change of the clocks has 23 h or 25 h: the times
// come from the local date and clock time, not from a count of hours.

/** The wall time of a local clock time, in minutes after midnight, on the local date of `date` plus `days`. */
const localTime = (date: Date, days: number, minutes: number): number =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    Math.floor(minutes / 60),
    minutes % 60
  ).getTime();

/** The play day of `now`, with the stop time `stopMinutes` in minutes after midnight. */
export const playDayOf = (now: number, stopMinutes: number): PlayDay => {
  const date = new Date(now);
  const days = now >= localTime(date, 0, DAY_START_MINUTES) ? 0 : -1;
  return {
    start: localTime(date, days, DAY_START_MINUTES),
    stop: localTime(date, days, stopMinutes),
    next: localTime(date, days + 1, DAY_START_MINUTES),
  };
};
