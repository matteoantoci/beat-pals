// The localStorage keys of the device storage (./index.ts). This file imports nothing, so the smoke run (scripts/)
// can read the keys with no resolve hook for the game model.

export const STORAGE_KEYS = {
  /** The progress (spec, "Save"). The schema version is inside the data (`SaveData.version`). */
  save: 'beat-pals:save',
  /** The session state (play-sessions spec, "Storage"). */
  session: 'beat-pals:session',
  /** The session settings of the parent area (session-schedule spec, "Settings"). */
  sessionSettings: 'beat-pals:session-settings',
  /** The Sound effects switch: "off" or "on". */
  sound: 'beat-pals:sound',
  /** The step that the guided song setup reached. */
  setup: 'beat-pals:setup',
  /** The decode rate of the device in ms for each MB of encoded audio. */
  decodeRate: 'beat-pals:decode-rate',
  /** The last load problem and its time. */
  loadProblem: 'beat-pals:load-problem',
} as const;
