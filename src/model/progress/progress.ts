// The progress of one song (spec, "Progress"): the record color, the stars of that color, and the weak plays in a
// row. A play at 70% or more earns the next star, and the third star opens the next color with 0 stars. Level 0 has
// no record and no stars: one good play at every beat earns the bronze record. Stars are never lost. After 2 weak
// plays, the next play uses the speed step one below, inside the same color only; a good play at that lower step
// earns no star, so a star is always earned at her own speed.

import { bandOf, RECORD_COLORS, type RecordColor } from '../child/child-chart';
import type { Lane } from '../child/lanes';
import type { SpeedStep } from '../child/speed-steps';

/** color: 0 (no record) to 4 platinum. stars: the stars of that color (3 only at platinum, the top). */
export type SongProgress = {
  readonly color: 0 | 1 | 2 | 3 | 4;
  readonly stars: 0 | 1 | 2 | 3;
  readonly weakPlays: 0 | 1 | 2;
};

/** A song with no play yet: level 0, with no record and no stars. */
export const NEW_SONG: SongProgress = { color: 0, stars: 0, weakPlays: 0 };

/** The lowest hit ratio of a good play. */
const GOOD_RATIO = 0.7;
/** Below this hit ratio only the band dances. */
const BAND_DANCES_BELOW = 0.4;

/** The record color and the speed step of the next play of a song. */
type PlaySetup = {
  readonly color: RecordColor;
  readonly step: SpeedStep;
  /** True when 2 weak plays put this play one speed step below the earned step. */
  readonly steppedDown: boolean;
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

/** Level 0 (no record) plays every beat (speed step 2), and it never steps down. */
const FIRST_LEVEL: PlaySetup = { color: 'none', step: 2, steppedDown: false };

export const playSetup = (progress: SongProgress): PlaySetup => {
  if (progress.color === 0) {
    return FIRST_LEVEL;
  }
  const earned = EARNED_STEP[progress.stars];
  const steppedDown = progress.weakPlays === 2 && earned > 0;
  return { color: RECORD_COLORS[progress.color], step: steppedDown ? STEP_BELOW[earned] : earned, steppedDown };
};

/** The pal of the opened color that is not in the band of the color before. */
const joinerOf = (before: SongProgress, opened: RecordColor): Lane | null => {
  const old = bandOf(RECORD_COLORS[before.color]);
  return bandOf(opened).find((lane) => !old.includes(lane)) ?? null;
};

/** The progress after a play with the hit ratio `ratio`. */
export const outcomeOf = (before: SongProgress, ratio: number): PlayOutcome => {
  const nothing = { before, star: null, opened: null, joins: null } as const;
  if (ratio < GOOD_RATIO) {
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

/** Below 40% the band dances; to below 70% the waiting pals dance too; from 70% all pals dance with confetti. */
export const danceOf = (ratio: number): Dance => {
  if (ratio < BAND_DANCES_BELOW) {
    return 'band';
  }
  return ratio < GOOD_RATIO ? 'band-and-waiting' : 'party';
};
