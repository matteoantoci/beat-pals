// The session state and the session settings in localStorage (play-sessions spec, "Storage"; session-schedule spec,
// "Settings"). They have their own keys, not the save, so the save code and the reset of the parent area keep them.
// The state is written at each change and on `visibilitychange` to hidden, as the save is. A failed write keeps the
// state for this run. A read never throws: damaged data gives the awake state and the default settings.

import { restoreSession, restoreSessionSettings, storedSession, storedSessionSettings } from '../model';
import type { PlayDay, SessionSettings, SessionState } from '../model';

const SESSION_KEY = 'beat-pals:session';
const SETTINGS_KEY = 'beat-pals:session-settings';

/** The stored JSON of the key, or null when the key is missing, damaged, or localStorage is blocked. */
const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

/** The stored session state at `now` in the play day `day`, with the gap rule applied. */
export const readSession = (now: number, day: PlayDay): SessionState => restoreSession(readJson(SESSION_KEY), now, day);

/** Writes the session state. A failed write (full storage, a blocked origin) must not stop the game. */
export const writeSession = (state: SessionState): void => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(storedSession(state)));
  } catch {
    // The state stays for this run; the next change tries again.
  }
};

/** The settings of this run, read once. */
let settings: SessionSettings | undefined;

/** The session settings of the parent area: the defaults of the model when there is no setting. */
export const loadSessionSettings = (): SessionSettings => {
  settings ??= restoreSessionSettings(readJson(SETTINGS_KEY));
  return settings;
};

/** Writes the session settings. They apply from the next session. A failed write keeps them for this run. */
export const storeSessionSettings = (next: SessionSettings): void => {
  settings = next;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(storedSessionSettings(next)));
  } catch {
    // The settings stay for this run.
  }
};
