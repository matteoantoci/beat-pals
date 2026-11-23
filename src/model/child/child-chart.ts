// The child chart (spec, "The child chart"): the notes that the child taps in one play, made from the facts for
// the record color and the speed step of the play. The notes of the fills join the guitar notes first. Then the
// passes run in this order: the filter, the lane mapping, the doubles, and the holds.

import { addDoubles, type NoteLanes } from './doubles';
import { filterNotes, refillGaps } from './filter';
import { holdLengths } from './holds';
import { type Lane, mapLanes } from './lanes';
import { addOffBeat } from './off-beat';
import { keptBeats, type SpeedStep, timedBeats } from './speed-steps';
import type { SongFacts } from '../chart/facts';

/** A note of the child chart. `holdSec` is 0 for a plain note. */
type ChildNote = { t: number; lanes: NoteLanes; holdSec: number };

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

/** The colors with doubles and soft holds: platinum and up. */
const ACCENTS: ReadonlySet<RecordColor> = new Set(['platinum', 'diamond']);

/** The band of a record color: the lanes of the pals that play. */
export const bandOf = (color: RecordColor): readonly Lane[] => BANDS[color];

/** The child chart of the facts for one play. */
export const childChart = (facts: SongFacts, color: RecordColor, step: SpeedStep): ChildChart => {
  const notes = [...facts.notes, ...facts.fills.flatMap((fill) => fill.notes)].toSorted((a, b) => a.t - b.t);
  const beats = timedBeats(facts.beats);
  const kept = keptBeats(facts.beats, step);
  const onBeat = refillGaps(notes, filterNotes(notes, kept), { kept, beats });
  const filtered = color === 'diamond' ? addOffBeat(notes, onBeat, { beats, step }) : onBeat;
  const band = BANDS[color];
  const lanes = mapLanes(filtered, band);
  if (!ACCENTS.has(color)) {
    return { band, notes: filtered.map((note, at) => ({ t: note.t, lanes: [lanes[at] ?? DOT], holdSec: 0 })) };
  }
  const doubles = addDoubles(
    filtered,
    lanes,
    beats.filter((_, at) => facts.beats[at]?.downbeat === true)
  );
  const holds = holdLengths(filtered, beats);
  return {
    band,
    notes: filtered.map((note, at) => ({ t: note.t, lanes: doubles[at] ?? [DOT], holdSec: holds[at] ?? 0 })),
  };
};
