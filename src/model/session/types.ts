// The types and the constants of the session model (play-sessions spec, section "Session model", changed by the
// session-schedule spec). All states are plain JSON, so localStorage can hold them. All times are wall times in ms
// since the epoch, from the caller. The model never reads a clock or the local time: the caller gives the play day.

/** The choices of the time limit of a session in the parent area, in minutes. */
export const SESSION_MINUTES = [5, 10, 15, 20, 25, 30] as const;
/** The choices of the day budget in the parent area, in minutes. */
export const DAY_MINUTES = [15, 30, 45, 60, 75, 90] as const;
/** The choices of the rest time in the parent area, in minutes. */
export const REST_MINUTES = [30, 60, 90, 120] as const;
/** The choices of the stop time in the parent area, in minutes after midnight: 18:00 to 21:00 in steps of 30 min. */
export const STOP_MINUTES = [1080, 1110, 1140, 1170, 1200, 1230, 1260] as const;

/** The day start: 5:00 local time, in minutes after midnight. It is not a setting. */
export const DAY_START_MINUTES = 300;

/** The settings of the parent area. */
export type SessionSettings = {
  /** The time limit of a session. */
  readonly minutes: (typeof SESSION_MINUTES)[number];
  /** The day budget: the minutes that she can play in a play day. */
  readonly dayMinutes: (typeof DAY_MINUTES)[number];
  /** The shortest time from a goodbye to the next session start. */
  readonly restMinutes: (typeof REST_MINUTES)[number];
  /** The stop time, in minutes after midnight. */
  readonly stopMinutes: (typeof STOP_MINUTES)[number];
};

/** The settings until the parent changes them: 15 minutes, 45 minutes a day, a rest time of 1 h, a stop at 20:00. */
export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  minutes: 15,
  dayMinutes: 45,
  restMinutes: 60,
  stopMinutes: 1200,
};

/**
 * The play day of a wall time, from the local calendar of the shell (src/shell/play-day.ts). `start`: the last day
 * start at or before the wall time. `stop`: the stop time on the local date of `start`. `next`: the next day start.
 */
export type PlayDay = { readonly start: number; readonly stop: number; readonly next: number };

/** The time used in a play day: `start` is the day start of that play day. */
export type Today = { readonly start: number; readonly usedMs: number };

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
  /** The time limit of the session: the minutes of the settings, or less when the day budget has less left. */
  readonly limitMs: number;
  /** Opened after "Open a new session now": it does not use the day budget, and the stop time does not apply. */
  readonly byParent: boolean;
  readonly usedMs: number;
  readonly shownStage: SunStage;
  /** The time of the last counted step, or null when the time does not count. */
  readonly countingSince: number | null;
  /** The time of the last hide, or null while the page shows. */
  readonly hiddenAt: number | null;
  /** The start of the last song, or null before it. */
  readonly lastSongAt: number | null;
  readonly today: Today;
};

export type Asleep = { readonly kind: 'asleep'; readonly until: number; readonly today: Today };

/**
 * Awake: the pals are awake and no session is open. Open: a session is open. Asleep: the pals sleep until `until`.
 * `today`: the time used in the current play day by the sessions that the parent did not open.
 */
export type SessionState =
  | { readonly kind: 'awake'; readonly today: Today; readonly byParent: boolean }
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
  | { readonly type: 'show'; readonly now: number; readonly day: PlayDay }
  /** The song list opens with the current settings. It also starts the count. */
  | { readonly type: 'list-open'; readonly now: number; readonly day: PlayDay; readonly settings: SessionSettings }
  | { readonly type: 'song-start'; readonly now: number; readonly day: PlayDay }
  | { readonly type: 'load-failed'; readonly now: number }
  /** The start of the goodbye scene. */
  | { readonly type: 'goodbye'; readonly now: number; readonly day: PlayDay }
  /** "Open a new session now" in the parent area. */
  | { readonly type: 'open-now'; readonly now: number; readonly day: PlayDay }
  /** A tap on the night title. */
  | { readonly type: 'wake-tap'; readonly now: number; readonly day: PlayDay }
  /** The normal title shows, or the timer of the shell fires while it shows. It applies the start conditions. */
  | { readonly type: 'title-show'; readonly now: number; readonly day: PlayDay; readonly settings: SessionSettings };

/**
 * The state after an event. `step`: the step of the sun that a list-open plays, or null. `last`: true when a
 * song-start starts the last song.
 */
export type SessionAnswer = {
  readonly state: SessionState;
  readonly step: SunStep | null;
  readonly last: boolean;
};

/**
 * The facts of the status line of the parent area, in whole minutes. `usedTodayMinutes` and `dayMinutes`: the day
 * budget. `byParent`: after "Open a new session now". Open: the time used and the limit of the session. Asleep:
 * `untilDayStart` is true when the pals sleep until the next day start (5:00). Rest-time-over: the pals sleep, and the
 * next tap wakes them.
 */
export type SessionStatus =
  | {
      readonly kind: 'awake';
      readonly usedTodayMinutes: number;
      readonly dayMinutes: number;
      readonly byParent: boolean;
    }
  | {
      readonly kind: 'open';
      readonly usedTodayMinutes: number;
      readonly dayMinutes: number;
      readonly byParent: boolean;
      readonly usedMinutes: number;
      readonly limitMinutes: number;
    }
  | { readonly kind: 'asleep'; readonly minutesLeft: number; readonly untilDayStart: boolean }
  | { readonly kind: 'rest-time-over' };

export const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The song allowance L: longer than the longest song (4:57), so the model never needs the length of a song. */
export const SONG_ALLOWANCE_MS = 5 * MINUTE_MS;

/** A restore cuts an asleep-until to at most this time after `now`, for a clock that went back. */
export const DAY_MS = 24 * HOUR_MS;
