import type { SessionSettings, SessionStatus } from '../../model';

// The texts of the "Play sessions" section of the parent area (play-sessions spec, "Parent"). They use time spans
// only.

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

/** The calculated line: the day budget and the minutes of a session. */
export const planLine = (settings: SessionSettings): string =>
  `Up to ${String(settings.dayMinutes)} minutes a day, in sessions of up to ${String(settings.minutes)} minutes.`;
