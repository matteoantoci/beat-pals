import { DAY_START_MINUTES } from '../../model';
import type { SessionSettings, SessionStatus } from '../../model';

// The texts of the "Play sessions" section of the parent area (session-schedule spec, "Parent area"). Clock times
// are allowed here, because only an adult gets in. The child's screens show no clock time.

/** A time span in whole minutes, as "45 min", "1 h", or "1 h 20 min". */
export const spanText = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${String(remainder)} min`;
  }
  return remainder === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(remainder)} min`;
};

/** A clock time of minutes after midnight, as "5:00" or "19:45". */
export const clockText = (minutes: number): string =>
  `${String(Math.floor(minutes / 60))}:${String(minutes % 60).padStart(2, '0')}`;

/** The status line: the state of the session for the parent. */
export const statusLine = (status: SessionStatus): string => {
  if (status.kind === 'asleep') {
    return status.untilDayStart
      ? `Asleep until ${clockText(DAY_START_MINUTES)}`
      : `Asleep for ${spanText(status.minutesLeft)} more`;
  }
  if (status.kind === 'rest-time-over') {
    return 'The pals wake at the next tap';
  }
  const today = `${String(status.usedTodayMinutes)} of ${String(status.dayMinutes)} minutes used today`;
  if (status.kind === 'awake') {
    return `${today} · the pals are awake`;
  }
  const session = `${String(status.usedMinutes)} of ${String(status.limitMinutes)} in this session`;
  return `${today} · ${session}${status.byParent ? ', which you opened' : ''}`;
};

/** The calculated line: the day budget, the minutes of a session, the rest time, and the last session start. */
export const planLine = (settings: SessionSettings): string =>
  `Up to ${String(settings.dayMinutes)} minutes a day, in sessions of up to ${String(settings.minutes)} minutes, ` +
  `with at least ${spanText(settings.restMinutes)} between sessions. ` +
  `The last session starts at ${clockText(settings.stopMinutes - settings.minutes)}.`;
