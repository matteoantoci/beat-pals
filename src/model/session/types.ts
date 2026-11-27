// The types and the constants of the session model (spec "Play sessions", section "Session model"). All states are
// plain JSON, so localStorage can hold them. All times are wall times in ms since the epoch, from the caller.

/** The choices of the time limit of a session in the parent area, in minutes. */
export const SESSION_MINUTES = [5, 10, 15, 20, 25, 30] as const;
/** The choices of the sessions per day in the parent area. */
export const SESSIONS_PER_DAY = [1, 2, 3, 4, 5, 6] as const;

/** The settings of the parent area: the time limit of a session, and the sessions per day. */
export type SessionSettings = {
  readonly minutes: (typeof SESSION_MINUTES)[number];
  readonly perDay: (typeof SESSIONS_PER_DAY)[number];
};

/** The settings until the parent changes them. */
export const DEFAULT_SESSION_SETTINGS: SessionSettings = { minutes: 10, perDay: 4 };

/** The stages of the sun in a session, in their order. */
export const SUN_STAGES = ['day', 'afternoon', 'sunset'] as const;

/** The stage of the sun in a session. */
export type SunStage = (typeof SUN_STAGES)[number];

/** The step animation of the sun on the song list. */
export type SunStep = { readonly from: SunStage; readonly to: SunStage };

export type Open = {
  readonly kind: 'open';
  /** The settings when the session opened. A change of a setting applies from the next session. */
  readonly settings: SessionSettings;
  /** The list-open that opened the session. */
  readonly startedAt: number;
  /** Opened after "Open a new session now": its start is not in the rolling cap. */
  readonly byParent: boolean;
  readonly usedMs: number;
  readonly shownStage: SunStage;
  /** The time of the last counted step, or null when the time does not count. */
  readonly countingSince: number | null;
  /** The time of the last hide, or null while the page shows. */
  readonly hiddenAt: number | null;
  /** The start of the last song, or null before it. */
  readonly lastSongAt: number | null;
  readonly starts: readonly number[];
};

export type Asleep = { readonly kind: 'asleep'; readonly until: number; readonly starts: readonly number[] };

/**
 * Awake: the pals are awake and no session is open. Open: a session is open. Asleep: the pals sleep until `until`.
 * `starts`: the session starts of the last 24 h that count for the rolling cap.
 */
export type SessionState =
  | { readonly kind: 'awake'; readonly starts: readonly number[]; readonly byParent: boolean }
  | Open
  | Asleep;

export type SessionEvent =
  /** A counted screen shows while the page is visible. */
  | { readonly type: 'count-start'; readonly now: number }
  /** A screen that does not count shows. */
  | { readonly type: 'count-stop'; readonly now: number }
  /** At least every 15 s while the time counts. */
  | { readonly type: 'tick'; readonly now: number }
  /** The page is hidden: stops the count and keeps the time of the hide. */
  | { readonly type: 'hide'; readonly now: number }
  /** The page is visible again: applies the gap rule. The count starts again only at the next count-start. */
  | { readonly type: 'show'; readonly now: number }
  /** The song list opens with the current settings. It also starts the count. */
  | { readonly type: 'list-open'; readonly now: number; readonly settings: SessionSettings }
  | { readonly type: 'song-start'; readonly now: number }
  | { readonly type: 'load-failed'; readonly now: number }
  /** The start of the goodbye scene. */
  | { readonly type: 'goodbye'; readonly now: number }
  /** "Open a new session now" in the parent area. */
  | { readonly type: 'open-now'; readonly now: number }
  /** A tap on the night title. */
  | { readonly type: 'wake-tap'; readonly now: number };

/**
 * The state after an event. `step`: the step of the sun that a list-open plays, or null. `last`: true when a
 * song-start starts the last song.
 */
export type SessionAnswer = {
  readonly state: SessionState;
  readonly step: SunStep | null;
  readonly last: boolean;
};

/** The facts of the status line of the parent area. Rest-time-over: the pals sleep, and the next tap wakes them. */
export type SessionStatus =
  | { readonly kind: 'awake' }
  | { readonly kind: 'open'; readonly usedMinutes: number; readonly limitMinutes: number }
  | { readonly kind: 'asleep'; readonly minutesLeft: number }
  | { readonly kind: 'rest-time-over' };

export const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The song allowance L: longer than the longest song (4:57), so the model never needs the length of a song. */
export const SONG_ALLOWANCE_MS = 5 * MINUTE_MS;

/** WAKING_DAY: the session spacing is this time divided by the sessions per day. */
export const WAKING_DAY_MS = 12 * HOUR_MS;

/** The window of the rolling cap: at most `perDay` session starts in any 24 h. */
export const DAY_MS = 24 * HOUR_MS;
