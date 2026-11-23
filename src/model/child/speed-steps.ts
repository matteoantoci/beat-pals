// The beat patterns of the speed steps (spec, "The child chart"). A pattern counts the beats of the facts in
// each bar. When a beat is shorter than about 0.43 s, half notes count as beats: every second beat from each
// downbeat counts, and 2 bars count as one bar. The counted beats of a bar take the numbers 1, 2, 3, and so on.
// - Step 0 keeps the odd beats: 1 and 3 in 4/4.
// - Step 1 keeps all beats except the last beat of the bar: 1, 2, and 3 in 4/4.
// - Step 2 keeps every beat.
// Beats before the first downbeat are not kept.

import type { SongFacts } from '../chart/facts';

/** The speed step of a play: 0, 1, or 2 stars. */
export type SpeedStep = 0 | 1 | 2;

/** A beat of the facts with its length: the time to the next beat. */
export type TimedBeat = { t: number; len: number };

/** Below this beat length in seconds (above about 140 BPM), half notes count as beats. */
const HALF_NOTES_BELOW_SEC = 0.43;
/** The beat length of a song with one beat only: 120 BPM, the tempo of a chart with no tempo. */
const LONE_BEAT_SEC = 0.5;

/** Each beat of the facts with its length. The last beat has the length of the beat before it. */
const timedBeats = (beats: SongFacts['beats']): TimedBeat[] =>
  beats.map((beat, at) => {
    const next = beats[at + 1] ?? beat;
    const before = beats[at - 1] ?? beat;
    const len = next === beat ? beat.t - before.t : next.t - beat.t;
    return { t: beat.t, len: len > 0 ? len : LONE_BEAT_SEC };
  });

/** The bars from the first downbeat on, as lists of beat indices. Each downbeat starts a bar. */
const barsOf = (beats: SongFacts['beats']): number[][] => {
  const bars: number[][] = [];
  beats.forEach((beat, at) => {
    if (beat.downbeat) {
      bars.push([at]);
    } else {
      bars.at(-1)?.push(at);
    }
  });
  return bars;
};

/** The counted bars: the bars as they are, or with half notes as beats and 2 fast bars as one bar. */
const countedBars = (beats: SongFacts['beats'], timed: readonly TimedBeat[]): number[][] => {
  const counted: number[][] = [];
  let waiting: number[] | undefined;
  barsOf(beats).forEach((bar) => {
    const beatSec = bar.reduce((sum, at) => sum + (timed[at]?.len ?? 0), 0) / bar.length;
    if (beatSec >= HALF_NOTES_BELOW_SEC) {
      counted.push(...(waiting === undefined ? [] : [waiting]), bar);
      waiting = undefined;
      return;
    }
    const halves = bar.filter((_, place) => place % 2 === 0);
    if (waiting === undefined) {
      waiting = halves;
    } else {
      counted.push([...waiting, ...halves]);
      waiting = undefined;
    }
  });
  return waiting === undefined ? counted : [...counted, waiting];
};

/** Whether a step keeps the counted beat at `place` (0 for beat 1) of a bar with `count` counted beats. */
const keeps = (step: SpeedStep, place: number, count: number): boolean => {
  if (step === 0) {
    return place % 2 === 0;
  }
  // Beat 1 is also the last beat of a bar with one counted beat. Step 1 keeps it, as step 0 does.
  return step === 2 || place < count - 1 || place === 0;
};

/** The beats of the facts that the speed step keeps, in time order, with their lengths. */
export const keptBeats = (beats: SongFacts['beats'], step: SpeedStep): TimedBeat[] => {
  const timed = timedBeats(beats);
  return countedBars(beats, timed).flatMap((bar) =>
    bar.flatMap((at, place) => (keeps(step, place, bar.length) ? (timed[at] ?? []) : []))
  );
};
