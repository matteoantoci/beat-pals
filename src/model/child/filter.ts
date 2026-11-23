// The filter of the child chart (spec, "The child chart"): a priority pass, not a greedy pass forward in time.
// A note is on a beat when it is within 10% of a beat length of the beat time. Each kept beat takes the
// nearest note that is on it, and the earlier note wins at equal distance. The filter drops all other notes.
// Then the refill: in a gap of more than 8 s between 2 accepted notes, the dropped notes on a beat of the facts
// join again, at the spacing of the kept beats in that gap. So a part where the guitar plays only on beats that the
// speed step does not keep gives no long wait.

import type { SongFacts } from '../chart/facts';
import type { TimedBeat } from './speed-steps';

type FactsNote = SongFacts['notes'][number];

/** A note is on a beat within this share of the beat length. */
const ON_BEAT_SHARE = 0.1;
/** The facts keep times to the microsecond, so a note at exactly 10% can be a microsecond off. */
const TIME_PRECISION = 1e-6;
/** A gap between accepted notes longer than this is refilled: the same limit as a long rest in the facts. */
const LONG_GAP_SEC = 8;

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

/** Whether a time is on a beat: within 10% of a beat length of the nearest beat before or after it. */
export const isOnBeat = (t: number, beats: readonly TimedBeat[]): boolean => {
  let low = 0;
  let high = beats.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const before = (beats[middle]?.t ?? Number.POSITIVE_INFINITY) < t;
    low = before ? middle + 1 : low;
    high = before ? high : middle;
  }
  return [beats[low - 1], beats[low]].some(
    (beat) => beat !== undefined && Math.abs(beat.t - t) <= beat.len * ON_BEAT_SHARE + TIME_PRECISION
  );
};

/** The notes that the kept beats take, in time order. `notes` are in time order. */
export const filterNotes = (notes: readonly FactsNote[], kept: readonly TimedBeat[]): FactsNote[] => {
  const taken = new Set(kept.flatMap((beat) => nearestOn(notes, beat) ?? []));
  return [...taken].toSorted((a, b) => a - b).flatMap((at) => notes[at] ?? []);
};

/**
 * The notes on a beat that refill the gap from `from` to `to`, in time order. Each note is at least `spacing` after
 * the note before it and at least `spacing` before `to`.
 */
const refillGap = (
  notes: readonly FactsNote[],
  { from, to, spacing }: { from: number; to: number; spacing: number },
  beats: readonly TimedBeat[]
): FactsNote[] => {
  const joined: FactsNote[] = [];
  let last = from;
  notes.slice(firstAtOrAfter(notes, from + spacing), firstAtOrAfter(notes, to)).forEach((note) => {
    if (note.t - last >= spacing && to - note.t >= spacing && isOnBeat(note.t, beats)) {
      joined.push(note);
      last = note.t;
    }
  });
  return joined;
};

/**
 * The accepted notes with the notes that refill each long gap, in time order. In a gap of more than 8 s between 2
 * accepted notes, the notes on a beat of the facts join in time order. A note joins only when it is at least the
 * spacing of the kept beats in the gap after the note before it and before the next accepted note.
 */
export const refillGaps = (
  notes: readonly FactsNote[],
  accepted: readonly FactsNote[],
  { kept, beats }: { kept: readonly TimedBeat[]; beats: readonly TimedBeat[] }
): FactsNote[] =>
  accepted.flatMap((note, at) => {
    const next = accepted[at + 1];
    if (next === undefined || next.t - note.t <= LONG_GAP_SEC + TIME_PRECISION) {
      return [note];
    }
    const inside = kept.filter((beat) => beat.t > note.t && beat.t < next.t).length;
    const spacing = (next.t - note.t) / (inside + 1) - TIME_PRECISION;
    return [note, ...refillGap(notes, { from: note.t, to: next.t, spacing }, beats)];
  });
