// The empty taps of a play (spec, "Play rules"): a tap that hits no note and lowers the score. It gives no event and
// changes nothing in the play. A tap far from every note of its lane is never empty. A tap near an open note that it
// missed is never empty: a late tap counts only as the miss.

import type { ChildChart } from '../child/child-chart';
import type { Lane } from './play-events';

/** A tap farther than this from every note of its lane is never empty: an intro, or a guitar break. */
const EMPTY_NEAR_SEC = 1.5;
/** A tap farther than this many good windows from every note of its lane is in a rest. */
const REST_WINDOWS = 2;
/** A tap on the other lane of a double this close to the tap that hit it is part of that tap. */
const PARTNER_SEC = 0.2;

/**
 * Which taps that hit no note are empty:
 * - 'second': a second tap, whose nearest note in its lane was already hit.
 * - 'second-and-rest': also, at level 0, a tap in a rest: more than 2 good windows from every note of its lane.
 * - 'free': none, after the escape at level 0.
 */
export type EmptyTaps = 'second' | 'second-and-rest' | 'free';

/** The tap that hit a note: its song time and its lane. */
export type HitTap = { readonly t: number; readonly lane: Lane };

/** What the rule reads of the play. */
type Judged = {
  readonly chart: ChildChart;
  readonly good: readonly number[];
  readonly hit: readonly (HitTap | undefined)[];
  readonly emptyTaps: EmptyTaps;
};

/** Whether a tap in a band lane that hit no note is empty. The nearest note wins; at equal distance, the earlier one. */
export const isEmptyTap = (play: Judged, lane: Lane, t: number): boolean => {
  if (play.emptyTaps === 'free') {
    return false;
  }
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
  const hitBy = play.hit[nearest.at];
  if (hitBy !== undefined) {
    // A tap on the other lane of a double, just after the tap that hit it, is part of that tap.
    const partner = hitBy.lane !== lane && play.chart.notes[nearest.at]?.lanes.includes(lane) === true;
    return !(partner && Math.abs(t - hitBy.t) < PARTNER_SEC);
  }
  return play.emptyTaps === 'second-and-rest' && near.every(({ at, gap }) => gap > REST_WINDOWS * (play.good[at] ?? 0));
};
