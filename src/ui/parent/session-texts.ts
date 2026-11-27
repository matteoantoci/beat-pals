import { MINUTE_MS, WAKING_DAY_MS } from '../../model';
import type { SessionSettings, SessionStatus } from '../../model';

// The texts of the "Play sessions" section of the parent area (play-sessions spec, "Parent"). They use time spans
// only and never a clock time, because the game uses no clock time and no day boundary.

/** A time span in whole minutes, as "45 min", "1 h", or "1 h 20 min". */
export const spanText = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${String(remainder)} min`;
  }
  return remainder === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(remainder)} min`;
};

/** The status line: the state of the session for the parent. */
export const statusLine = (status: SessionStatus): string => {
  if (status.kind === 'awake') {
    return 'The pals are awake. A session starts when the song list opens.';
  }
  if (status.kind === 'open') {
    return `${String(status.usedMinutes)} of ${String(status.limitMinutes)} minutes used`;
  }
  return status.kind === 'asleep' ? `Asleep for ${spanText(status.minutesLeft)} more` : 'The pals wake at the next tap';
};

/** The calculated line: the session spacing, and the minutes times the sessions per day. */
export const planLine = (settings: SessionSettings): string =>
  `A new session about every ${spanText(Math.round(WAKING_DAY_MS / settings.perDay / MINUTE_MS))}, ` +
  `at most ${String(settings.minutes * settings.perDay)} minutes a day.`;
