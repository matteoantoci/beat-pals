// Filter step 3 of the child chart (spec, "The child chart"): at diamond, off-beat notes (on no beat of the facts)
// join the accepted notes in time order. An off-beat note joins only when no accepted note is closer to it than
// 0.43 s, and when, with it, the off-beat share of the accepted notes at or before its time stays at or below the
// cap of the speed step.

import { isOnBeat } from './filter';
import type { SongFacts } from '../chart/facts';
import type { SpeedStep, TimedBeat } from './speed-steps';

type FactsNote = SongFacts['notes'][number];

/** No accepted note may be closer than this to an off-beat note that joins. */
const OFF_BEAT_GAP_SEC = 0.43;
/** The facts round times to the microsecond: a gap this much short of the rule still meets it. */
const TIME_PRECISION = 1e-6;
/** The highest off-beat share of the accepted notes for each speed step. */
const OFF_BEAT_CAPS: Readonly<Record<SpeedStep, number>> = { 0: 0.2, 1: 0.35, 2: 0.5 };

/** The index of the first accepted note after `t`. */
const firstAfter = (accepted: readonly number[], t: number): number => {
  let low = 0;
  let high = accepted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const before = (accepted[middle] ?? Number.POSITIVE_INFINITY) <= t;
    low = before ? middle + 1 : low;
    high = before ? high : middle;
  }
  return low;
};

/** The accepted notes with the off-beat notes that join, in time order. All lists are in time order. */
export const addOffBeat = (
  notes: readonly FactsNote[],
  onBeat: readonly FactsNote[],
  { beats, step }: { beats: readonly TimedBeat[]; step: SpeedStep }
): FactsNote[] => {
  const accepted = onBeat.map((note) => note.t);
  const joined: FactsNote[] = [...onBeat];
  // The off-beat notes join in time order, so a count of those at or before the note is a running count.
  let offSoFar = 0;
  notes
    .filter((note) => !isOnBeat(note.t, beats))
    .forEach((note) => {
      const at = firstAfter(accepted, note.t);
      const near = [accepted[at - 1], accepted[at]].some(
        (other) => other !== undefined && Math.abs(other - note.t) < OFF_BEAT_GAP_SEC - TIME_PRECISION
      );
      if (near || (offSoFar + 1) / (at + 1) > OFF_BEAT_CAPS[step]) {
        return;
      }
      accepted.splice(at, 0, note.t);
      joined.push(note);
      offSoFar += 1;
    });
  return joined.toSorted((a, b) => a.t - b.t);
};
