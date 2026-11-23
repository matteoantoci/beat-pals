// The holds of the child chart (spec, "The child chart"), from gold up. A sustain ends at the latest at the next
// child note (in any lane) minus the good window of that note, so a hold never overlaps the next note. After that
// cut, a sustain of at least one beat becomes a soft hold. All other sustains become plain notes.

import { goodWindows } from '../play/windows';
import type { TimedBeat } from './speed-steps';

/** The facts keep times to the microsecond. */
const TIME_PRECISION = 1e-6;

/** The length of the beat at `t`: the last beat at or before it, or the first beat. */
const beatLenAt = (t: number, beats: readonly TimedBeat[]): number =>
  (beats.findLast((beat) => beat.t <= t + TIME_PRECISION) ?? beats[0])?.len ?? Number.POSITIVE_INFINITY;

/** The hold length of each note in time order: the cut sustain when it is one beat or more, else 0. */
export const holdLengths = (
  notes: readonly { readonly t: number; readonly lenSec: number }[],
  beats: readonly TimedBeat[]
): number[] => {
  const good = goodWindows(notes.map((note) => note.t));
  return notes.map((note, at) => {
    const next = notes[at + 1];
    const end = next === undefined ? Number.POSITIVE_INFINITY : next.t - (good[at + 1] ?? 0);
    const held = Math.round((Math.min(note.t + note.lenSec, end) - note.t) * 1e6) / 1e6;
    return held >= beatLenAt(note.t, beats) - TIME_PRECISION ? held : 0;
  });
};
