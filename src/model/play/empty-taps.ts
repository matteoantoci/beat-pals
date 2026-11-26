// The empty taps of a play (spec, "Play rules"): a tap that hits no note and lowers the score. It gives no event and
// changes nothing in the play. Level 0 has one lane, so a second tap or a tap in a rest is empty there. At the colors
// (bronze and up) the lanes already ask her to look. So only a tap in another band lane, inside the good window of a
// hit note, is empty there: a palm, or fingers on all lanes. A second tap in a lane of the hit note is free.

import type { ChildChart } from '../child/child-chart';
import type { Lane } from './play-events';

/** A tap farther than this from every note of its lane is never empty: an intro, or a guitar break. */
const EMPTY_NEAR_SEC = 1.5;
/** A tap farther than this many good windows from every note of its lane is in a rest. */
const REST_WINDOWS = 2;

/**
 * Which taps that hit no note are empty:
 * - 'second-and-rest' (level 0): a second tap or a tap in a rest. The nearest note of a second tap was already hit.
 *   A tap in a rest is more than 2 good windows from every note of its lane.
 * - 'other-lane' (the colors): a tap inside the good window of a hit note, in a band lane that the note does not use.
 * - 'free': none, after the escape at level 0.
 */
export type EmptyTaps = 'second-and-rest' | 'other-lane' | 'free';

/** A stray tap: a tap in a band lane that hit no note. The 'other-lane' rule judges it when the notes near it pass. */
export type StrayTap = { readonly t: number; readonly lane: Lane };

/** What the rules read of the play. */
type Judged = { readonly chart: ChildChart; readonly good: readonly number[]; readonly hit: readonly boolean[] };

/**
 * Level 0: whether a tap that hit no note is empty. A tap far from every note of its lane, or near an open note that
 * it missed, is not empty: a late tap counts only as the miss. The nearest note wins; at equal distance, the earlier.
 */
const isLevelZeroEmpty = (play: Judged, lane: Lane, t: number): boolean => {
  const near = play.chart.notes.flatMap((note, at) =>
    note.lanes.includes(lane) && Math.abs(t - note.t) <= EMPTY_NEAR_SEC ? [{ at, gap: Math.abs(t - note.t) }] : []
  );
  const nearest = near.reduce<(typeof near)[number] | undefined>(
    (best, candidate) => (best === undefined || candidate.gap < best.gap ? candidate : best),
    undefined
  );
  if (nearest === undefined) {
    return false;
  }
  return play.hit[nearest.at] === true || near.every(({ at, gap }) => gap > REST_WINDOWS * (play.good[at] ?? 0));
};

/** What a missed tap changes in the play. */
type Counted = Judged & {
  readonly emptyTaps: EmptyTaps;
  readonly emptyCount: number;
  readonly stray: readonly StrayTap[];
};

/** A tap in a band lane that hit no note: level 0 judges it at once; the colors keep it for the 'other-lane' rule. */
export const missedTap = <P extends Counted>(play: P, lane: Lane, t: number): P => {
  if (play.emptyTaps === 'other-lane') {
    return { ...play, stray: [...play.stray, { t, lane }] };
  }
  const empty = play.emptyTaps === 'second-and-rest' && isLevelZeroEmpty(play, lane, t);
  return empty ? { ...play, emptyCount: play.emptyCount + 1 } : play;
};

/**
 * The colors: the number of stray taps that the closed notes make empty, and the stray taps that a later note can
 * still make empty. Good windows never overlap, so a stray tap at or before `end`, the end of the last closed window,
 * can count for no later note.
 */
export const otherLaneEmpties = (
  play: Judged & { readonly stray: readonly StrayTap[] },
  closed: readonly number[],
  end: number
): { readonly count: number; readonly stray: readonly StrayTap[] } => {
  const count = play.stray.filter(({ t, lane }) =>
    closed.some((at) => {
      const note = play.chart.notes[at];
      return (
        play.hit[at] === true &&
        note !== undefined &&
        !note.lanes.includes(lane) &&
        Math.abs(t - note.t) <= (play.good[at] ?? 0)
      );
    })
  ).length;
  return { count, stray: play.stray.filter(({ t }) => t > end) };
};
