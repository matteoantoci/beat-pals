// The doubles of the child chart (spec, "The child chart"), from platinum up, as accents. A chord on a downbeat
// becomes a double only when none of the 3 child notes before it is a double, so at most 1 in 4 child notes is a
// double. A double has its contour lane and one adjacent lane: Pip gives Pip + Dot, and Bo gives Dot + Bo. Dot gives
// Dot + Bo when the highest fret of the chord is 3 or 4, else Pip + Dot. All other chords stay one note.

import type { SongFacts } from '../chart/facts';
import type { Lane } from './lanes';
import type { TimedBeat } from './speed-steps';

type FactsNote = SongFacts['notes'][number];

/** The lanes of one child note: one lane, or the 2 adjacent lanes of a double. */
export type NoteLanes = [Lane] | [Lane, Lane];

/** A downbeat of the facts with its length. */
export type Downbeat = TimedBeat;

/** A note is on a beat within this share of the beat length (as in the filter). */
const ON_BEAT_SHARE = 0.1;
/** The facts keep times to the microsecond. */
const TIME_PRECISION = 1e-6;
/** A double needs this many child notes before it with no double. */
const NOTES_BETWEEN = 3;
/** The fret number of an open note in the facts. */
const OPEN_FRET = 7;
/** On Dot, a chord with a highest fret from this fret on goes to Dot + Bo. */
const HIGH_FRET = 3;

const onDownbeat = (t: number, downbeats: readonly Downbeat[]): boolean =>
  downbeats.some((beat) => Math.abs(t - beat.t) <= beat.len * ON_BEAT_SHARE + TIME_PRECISION);

/** The 2 lanes of a double for the chord in its contour lane. */
const doubleLanes = (lane: Lane, frets: readonly number[]): NoteLanes => {
  if (lane === 0) {
    return [0, 1];
  }
  if (lane === 2) {
    return [1, 2];
  }
  const highest = Math.max(...frets.filter((fret) => fret !== OPEN_FRET));
  return highest >= HIGH_FRET ? [1, 2] : [0, 1];
};

/** The lanes of each note in time order, with the doubles. `lanes` are the contour lanes of the notes. */
export const addDoubles = (
  notes: readonly FactsNote[],
  lanes: readonly Lane[],
  downbeats: readonly Downbeat[]
): NoteLanes[] => {
  let sinceDouble = NOTES_BETWEEN;
  return notes.map((note, at) => {
    const lane = lanes[at] ?? 1;
    const double = note.frets.length > 1 && sinceDouble >= NOTES_BETWEEN && onDownbeat(note.t, downbeats);
    sinceDouble = double ? 0 : sinceDouble + 1;
    return double ? doubleLanes(lane, note.frets) : [lane];
  });
};
