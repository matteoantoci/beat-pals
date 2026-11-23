// The song clock arithmetic (spec, "Sound and the audio clock"). The sound layer passes in the readings of the
// audio context, so the model reads no clock. Song time 0 is the start of the song audio.

/** The song starts this long after the current context time, so the source start is never in the past. */
const START_DELAY = 0.1;
/** The highway shows the notes of the next 2.0 s (C6). A play starts at least this long before its first note. */
export const LOOK_AHEAD = 2;
/** The guarded read adds at most this much time after the last output timestamp. */
const MAX_GAP = 0.05;

/** The values of one context reading. The sound layer reads them together. */
export type ClockReading = {
  /** The context state is `running`. */
  readonly running: boolean;
  /** `contextTime` of `getOutputTimestamp()`, in seconds. */
  readonly contextTime: number;
  /** `performanceTime` of `getOutputTimestamp()`, in milliseconds. 0 before the first output. */
  readonly performanceTime: number;
  /** `performance.now()`, in milliseconds. */
  readonly now: number;
};

/** A song that plays: song time = context time - `t0`. `frozen` is the song time while the clock cannot run. */
type SongClock = { readonly t0: number; readonly frozen: number };

/** Where to start the song source in the context. */
export type SongStart = {
  /** The context time of song time 0. */
  readonly t0: number;
  /** The context time at which the source starts. */
  readonly when: number;
  /** The time in the song audio at which the source starts, in seconds. */
  readonly offset: number;
};

/**
 * The song time at the start of a play. A first note earlier than the look-ahead (or negative from the chart delay)
 * makes it negative: the audio starts late by the difference, so each note enters at the top of the highway.
 */
export const firstSongTime = (firstNote: number): number => Math.min(0, firstNote - LOOK_AHEAD);

/** Starts the song at `songTime`, 0.1 s after `currentTime`. A negative song time delays the audio. */
export const startAt = (currentTime: number, songTime: number): SongStart => {
  const start = currentTime + START_DELAY;
  const t0 = start - songTime;
  return { t0, when: Math.max(start, t0), offset: Math.max(0, songTime) };
};

/**
 * The guarded song time. It is the frozen time unless the context runs and has an output timestamp. Then it adds
 * the page time since that timestamp, clamped to 0.05 s.
 */
export const songTime = (clock: SongClock, reading: ClockReading): number => {
  if (!reading.running || reading.performanceTime <= 0) {
    return clock.frozen;
  }
  const gap = Math.min(MAX_GAP, Math.max(0, (reading.now - reading.performanceTime) / 1000));
  return reading.contextTime - clock.t0 + gap;
};
