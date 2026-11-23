// The filter of the child chart (spec, "The child chart"): a priority pass, not a greedy pass forward in time.
// A note is on a beat when it is within 10% of a beat length of the beat time. Each kept beat takes the
// nearest note that is on it, and the earlier note wins at equal distance. The filter drops all other notes.

import type { SongFacts } from '../chart/facts';
import type { TimedBeat } from './speed-steps';

type FactsNote = SongFacts['notes'][number];

/** A note is on a beat within this share of the beat length. */
const ON_BEAT_SHARE = 0.1;
/** The facts keep times to the microsecond, so a note at exactly 10% can be a microsecond off. */
const TIME_PRECISION = 1e-6;

/** The index of the first note at or after `t`. `notes` are in time order. */
const firstAtOrAfter = (notes: readonly FactsNote[], t: number): number => {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const before = (notes[middle]?.t ?? Number.POSITIVE_INFINITY) < t;
    low = before ? middle + 1 : low;
    high = before ? high : middle;
  }
  return low;
};

/** The index of the nearest note on the beat, or undefined. The earlier note wins at equal distance. */
const nearestOn = (notes: readonly FactsNote[], beat: TimedBeat): number | undefined => {
  const reach = beat.len * ON_BEAT_SHARE + TIME_PRECISION;
  let nearest: number | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const end = beat.t + reach;
  for (let at = firstAtOrAfter(notes, beat.t - reach); (notes[at]?.t ?? Number.POSITIVE_INFINITY) <= end; at += 1) {
    const distance = Math.abs((notes[at]?.t ?? 0) - beat.t);
    nearest = distance < nearestDistance ? at : nearest;
    nearestDistance = Math.min(distance, nearestDistance);
  }
  return nearest;
};

/** The notes that the kept beats take, in time order. `notes` are in time order. */
export const filterNotes = (notes: readonly FactsNote[], kept: readonly TimedBeat[]): FactsNote[] => {
  const taken = new Set(kept.flatMap((beat) => nearestOn(notes, beat) ?? []));
  return [...taken].toSorted((a, b) => a - b).flatMap((at) => notes[at] ?? []);
};
