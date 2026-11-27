// The session state and the session settings of the device storage (play-sessions spec, "Storage"; session-schedule
// spec, "Settings"). They have their own keys, not the save, so the save code and the reset of the parent area keep
// them. The state is written at each change and on `visibilitychange` to hidden, as the save is. Damaged data gives
// the awake state and the default settings.

import { restoreSession, restoreSessionSettings, storedSession, storedSessionSettings } from '../model';
import type { PlayDay, SessionSettings, SessionState } from '../model';
import type { Codec, Slot } from './storage/slot';

/** The stored session state as JSON. The model restores it at a time and in a play day, so the slot keeps the JSON. */
export const sessionStateCodec: Codec<unknown> = {
  absent: null,
  decode: (text): unknown => JSON.parse(text),
  encode: (stored) => JSON.stringify(stored),
};

export const sessionSettingsCodec: Codec<SessionSettings> = {
  absent: restoreSessionSettings(null),
  decode: (text) => restoreSessionSettings(JSON.parse(text)),
  encode: (settings) => JSON.stringify(storedSessionSettings(settings)),
};

export type SessionStore = {
  /** The stored session state at `now` in the play day `day`, with the gap rule applied. */
  readonly read: (now: number, day: PlayDay) => SessionState;
  /** Writes the session state. A failed write keeps the state for this run; the next change tries again. */
  readonly write: (state: SessionState) => void;
  /** The session settings of the parent area: the defaults of the model when there is no setting. */
  readonly settings: () => SessionSettings;
  /** Writes the session settings. They apply from the next session. A failed write keeps them for this run. */
  readonly storeSettings: (next: SessionSettings) => void;
};

export const sessionStore = (state: Slot<unknown>, settings: Slot<SessionSettings>): SessionStore => ({
  read: (now, day) => restoreSession(state.get(), now, day),
  write: (next) => {
    state.set(storedSession(next));
  },
  settings: settings.get,
  storeSettings: (next) => {
    settings.set(next);
  },
});
