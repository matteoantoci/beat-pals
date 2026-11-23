// The lane mapping of the child chart (spec, "The child chart"): the lanes follow the melodic contour.
// The first note goes to Dot. A higher contour moves one lane to the right, a lower contour one lane to the left,
// and a move past the edge lane of the band stays. A lane changes only after 2 notes in the current lane, or after
// a gap of 1.2 s or more from the note before. So a note never jumps from Pip to Bo or from Bo to Pip.

import type { SongFacts } from '../chart/facts';

type FactsNote = SongFacts['notes'][number];

/** A lane: 0 Pip, 1 Dot, 2 Bo. */
export type Lane = 0 | 1 | 2;

/** The fret number of an open note in the facts. */
const OPEN_FRET = 7;
/** An open note counts below fret 0. */
const OPEN_CONTOUR = -1;
/** A lane changes only after this many notes in the current lane (a first value to tune). */
const NOTES_BEFORE_CHANGE = 2;
/** Or after a gap of this length from the note before (a first value to tune). */
const GAP_FOR_CHANGE_SEC = 1.2;
/** The facts keep times to the microsecond. */
const TIME_PRECISION = 1e-6;

const DOT: Lane = 1;

/** The contour value of a note: its lowest fret, with open below fret 0. */
const contourOf = (note: FactsNote): number =>
  Math.min(...note.frets.map((fret) => (fret === OPEN_FRET ? OPEN_CONTOUR : fret)));

/**
 * The lane of each note, in time order, for the lanes of the band. The band holds Dot and the lanes next to it, so a
 * move to a lane outside the band is a move past the edge lane, and the note stays.
 */
export const mapLanes = (notes: readonly FactsNote[], band: readonly Lane[]): Lane[] => {
  const lanes: Lane[] = [];
  let run = 0;
  notes.forEach((note, at) => {
    const before = notes[at - 1];
    const current = lanes.at(-1);
    if (before === undefined || current === undefined) {
      lanes.push(DOT);
      run = 1;
      return;
    }
    const free = run >= NOTES_BEFORE_CHANGE || note.t - before.t >= GAP_FOR_CHANGE_SEC - TIME_PRECISION;
    const move = Math.sign(contourOf(note) - contourOf(before));
    const lane = free ? (band.find((inBand) => inBand === current + move) ?? current) : current;
    run = lane === current ? run + 1 : 1;
    lanes.push(lane);
  });
  return lanes;
};
