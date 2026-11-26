// The progress of one song (spec, "Progress"): the record color, the stars of that color, and the weak plays in a
// row. A play with a score of 80% or more earns the next star, and the third star opens the next color with 0 stars.
// Level 0 has no record and no stars: one good play at every beat earns the bronze record. Stars are never lost.
// After 2 weak plays, the next play uses the speed step one below, inside the same color only; a good play at that
// lower step earns no star, so a star is always earned at her own speed. Level 0 never steps down: after 2 weak plays
// there, no empty tap counts (the escape), so she cannot stay stuck before bronze.

import { bandOf, RECORD_COLORS, type RecordColor } from '../child/child-chart';
import type { Lane } from '../child/lanes';
import type { SpeedStep } from '../child/speed-steps';
import type { EmptyTaps } from '../play/empty-taps';

/** color: 0 (no record) to 4 platinum. stars: the stars of that color (3 only at platinum, the top). */
export type SongProgress = {
  readonly color: 0 | 1 | 2 | 3 | 4;
  readonly stars: 0 | 1 | 2 | 3;
  readonly weakPlays: 0 | 1 | 2;
};

/** A song with no play yet: level 0, with no record and no stars. */
export const NEW_SONG: SongProgress = { color: 0, stars: 0, weakPlays: 0 };

/** The lowest score of a good play. A blind steady tap at level 0 scores at most about 75% (2026-11-26). */
const STAR_SCORE = 0.8;
/** Below this score only the band dances. */
const BAND_DANCES_BELOW = 0.4;

/** The record color and the speed step of the next play of a song. */
type PlaySetup = {
  readonly color: RecordColor;
  readonly step: SpeedStep;
  /** True when 2 weak plays put this play one speed step below the earned step. */
  readonly steppedDown: boolean;
  /** True at level 0: a rest on the last beat of each full bar (`childChart`). */
  readonly rests: boolean;
  /** Which taps that hit no note lower the score. */
  readonly emptyTaps: EmptyTaps;
};

/** What one play changed, for the save and for the end scene. */
export type PlayOutcome = {
  readonly before: SongProgress;
  readonly after: SongProgress;
  /** The star place (0 to 2) that the play filled on the record of `before`, or null for no new star. */
  readonly star: 0 | 1 | 2 | null;
  /** The record color that the third star opened, or null. */
  readonly opened: RecordColor | null;
  /** The pal that joins the band with the opened color (silver and gold only), or null. */
  readonly joins: Lane | null;
};

/** Who dances in the end scene. There is never a sad pal. */
export type Dance = 'band' | 'band-and-waiting' | 'party';

/** The speed step that the stars of the color earned: platinum with 3 stars stays at step 2. */
const EARNED_STEP: Readonly<Record<SongProgress['stars'], SpeedStep>> = { 0: 0, 1: 1, 2: 2, 3: 2 };
const STEP_BELOW: Readonly<Record<SpeedStep, SpeedStep>> = { 0: 0, 1: 0, 2: 1 };
const NEXT_STAR = { 0: 1, 1: 2, 2: 3 } as const;
const NEXT_COLOR = { 0: 1, 1: 2, 2: 3, 3: 4 } as const;

/** Level 0 (no record) plays every beat (speed step 2) with a rest in each full bar, counts taps in its rests, and
 * never steps down. */
const FIRST_LEVEL: PlaySetup = {
  color: 'none',
  step: 2,
  steppedDown: false,
  rests: true,
  emptyTaps: 'second-and-rest',
};
/** Level 0 after 2 weak plays: no empty tap counts. */
const FIRST_LEVEL_ESCAPE: PlaySetup = { ...FIRST_LEVEL, emptyTaps: 'free' };

export const playSetup = (progress: SongProgress): PlaySetup => {
  if (progress.color === 0) {
    return progress.weakPlays === 2 ? FIRST_LEVEL_ESCAPE : FIRST_LEVEL;
  }
  const earned = EARNED_STEP[progress.stars];
  const steppedDown = progress.weakPlays === 2 && earned > 0;
  return {
    color: RECORD_COLORS[progress.color],
    step: steppedDown ? STEP_BELOW[earned] : earned,
    steppedDown,
    rests: false,
    emptyTaps: 'other-lane',
  };
};

/** The pal of the opened color that is not in the band of the color before. */
const joinerOf = (before: SongProgress, opened: RecordColor): Lane | null => {
  const old = bandOf(RECORD_COLORS[before.color]);
  return bandOf(opened).find((lane) => !old.includes(lane)) ?? null;
};

/** The progress after a play with this score. */
export const outcomeOf = (before: SongProgress, score: number): PlayOutcome => {
  const nothing = { before, star: null, opened: null, joins: null } as const;
  if (score < STAR_SCORE) {
    return { ...nothing, after: { ...before, weakPlays: before.weakPlays === 0 ? 1 : 2 } };
  }
  // Platinum with 3 stars is the top, and a good play at the lower step earns no star.
  if (before.stars === 3 || playSetup(before).steppedDown) {
    return { ...nothing, after: { ...before, weakPlays: 0 } };
  }
  const star = before.stars;
  if (before.color === 4 || (star < 2 && before.color !== 0)) {
    const after: SongProgress = { color: before.color, stars: NEXT_STAR[star], weakPlays: 0 };
    return { ...nothing, after, star };
  }
  const color = NEXT_COLOR[before.color];
  const opened = RECORD_COLORS[color];
  const earned = before.color === 0 ? null : star;
  return { before, after: { color, stars: 0, weakPlays: 0 }, star: earned, opened, joins: joinerOf(before, opened) };
};

/** Below 40% the band dances; to below 80% the waiting pals dance too; from 80% all pals dance with confetti. */
export const danceOf = (score: number): Dance => {
  if (score < BAND_DANCES_BELOW) {
    return 'band';
  }
  return score < STAR_SCORE ? 'band-and-waiting' : 'party';
};
