// The child chart (spec, "The child chart"): the notes that the child taps in one play, made from the facts for
// the record color and the speed step of the play. The notes of the fills join the guitar notes first. Then the
// passes run in this order: the filter, the lane mapping, the doubles, and the holds.

import { filterNotes } from './filter';
import { type Lane, mapLanes } from './lanes';
import { addOffBeat } from './off-beat';
import { keptBeats, type SpeedStep, timedBeats } from './speed-steps';
import type { SongFacts } from '../chart/facts';

/** A note of the child chart. `holdSec` is 0 for a plain note. */
type ChildNote = { t: number; lanes: [Lane] | [Lane, Lane]; holdSec: number };

/** The record colors, from the first to the last. */
export const RECORD_COLORS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;

export type RecordColor = (typeof RECORD_COLORS)[number];

/** The child chart of a play: the lanes of the band (the pals that play) and the notes in time order. */
export type ChildChart = { band: readonly Lane[]; notes: ChildNote[] };

const DOT: Lane = 1;

/** The band of each record color: Dot at bronze, Pip joins at silver, and Bo joins at gold. */
const BANDS: Readonly<Record<RecordColor, readonly Lane[]>> = {
  bronze: [DOT],
  silver: [0, DOT],
  gold: [0, DOT, 2],
  platinum: [0, DOT, 2],
  diamond: [0, DOT, 2],
};

/** The band of a record color: the lanes of the pals that play. */
export const bandOf = (color: RecordColor): readonly Lane[] => BANDS[color];

/** The child chart of the facts for one play. */
export const childChart = (facts: SongFacts, color: RecordColor, step: SpeedStep): ChildChart => {
  const notes = [...facts.notes, ...facts.fills.flatMap((fill) => fill.notes)].toSorted((a, b) => a.t - b.t);
  const onBeat = filterNotes(notes, keptBeats(facts.beats, step));
  const filtered = color === 'diamond' ? addOffBeat(notes, onBeat, { beats: timedBeats(facts.beats), step }) : onBeat;
  const band = BANDS[color];
  const lanes = mapLanes(filtered, band);
  return { band, notes: filtered.map((note, at) => ({ t: note.t, lanes: [lanes[at] ?? DOT], holdSec: 0 })) };
};
