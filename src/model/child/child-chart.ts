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

/** The record colors, from the first level to the last. Level 0 has no record: the first good play earns bronze. */
export const RECORD_COLORS = ['none', 'bronze', 'silver', 'gold', 'platinum'] as const;

export type RecordColor = (typeof RECORD_COLORS)[number];

/** A phrase of the child chart: the indexes of its first and its last note. */
type ChildPhrase = { readonly first: number; readonly last: number };

/**
 * The child chart of a play: the lanes of the band (the pals that play), the notes in time order, and the phrases
 * for the star moments in time order.
 */
export type ChildChart = { band: readonly Lane[]; notes: ChildNote[]; phrases: ChildPhrase[] };

const DOT: Lane = 1;

/** The band of each record color: Dot alone with no record, Pip joins at bronze, and Bo joins at silver. */
const BANDS: Readonly<Record<RecordColor, readonly Lane[]>> = {
  none: [DOT],
  bronze: [0, DOT],
  silver: [0, DOT, 2],
  gold: [0, DOT, 2],
  platinum: [0, DOT, 2],
};

/** The colors with doubles and soft holds: gold and up. */
const ACCENTS: ReadonlySet<RecordColor> = new Set(['gold', 'platinum']);

/** The band of a record color: the lanes of the pals that play. */
export const bandOf = (color: RecordColor): readonly Lane[] => BANDS[color];

/** A phrase has at least this many child notes: a shorter one grows, and one that cannot grow is dropped (a first
 * value). */
const MIN_PHRASE_NOTES = 4;
/** The last note of a phrase and the first note of the next one are at least this far apart: about 4 star moments in
 * a song of 3 minutes (the parent found 8 s too often, 2026-11-24). */
const PHRASE_GAP_SEC = 30;

/**
 * The phrases of the facts over the child notes, in time order. Each phrase takes the child notes in its time range.
 * A phrase with fewer than 4 grows forward to 4 notes from its first note, but not up to the start of the next phrase
 * of the facts; one that still has fewer than 4 is dropped. A phrase whose first note comes less than 30 s after the
 * last note of the phrase before is dropped, so the star moments stay special.
 */
const childPhrases = (phrases: SongFacts['phrases'], notes: readonly { t: number }[]): ChildPhrase[] => {
  /** The index of the first note at or after `t`, or the number of notes. */
  const from = (t: number): number => {
    const at = notes.findIndex((note) => note.t >= t);
    return at === -1 ? notes.length : at;
  };
  /** Phrase `at` of the facts over the notes, grown to 4 notes when it can; undefined when it has fewer. */
  const grown = ({ t, end }: SongFacts['phrases'][number], at: number): ChildPhrase | undefined => {
    const first = from(t);
    const room = from(phrases[at + 1]?.t ?? Number.POSITIVE_INFINITY) - 1;
    const last = Math.max(from(end) - 1, Math.min(first + MIN_PHRASE_NOTES - 1, room));
    return last - first + 1 >= MIN_PHRASE_NOTES ? { first, last } : undefined;
  };
  return phrases.reduce<ChildPhrase[]>((kept, phrase, at) => {
    const next = grown(phrase, at);
    const before = notes[kept.at(-1)?.last ?? -1]?.t ?? Number.NEGATIVE_INFINITY;
    const start = next === undefined ? undefined : notes[next.first]?.t;
    return next !== undefined && start !== undefined && start - before >= PHRASE_GAP_SEC ? kept.concat(next) : kept;
  }, []);
};

/** The child chart of the facts for one play. */
export const childChart = (facts: SongFacts, color: RecordColor, step: SpeedStep): ChildChart => {
  const notes = [...facts.notes, ...facts.fills.flatMap((fill) => fill.notes)].toSorted((a, b) => a.t - b.t);
  const beats = timedBeats(facts.beats);
  const kept = keptBeats(facts.beats, step);
  const onBeat = refillGaps(notes, filterNotes(notes, kept), { kept, beats });
  const filtered = color === 'platinum' ? addOffBeat(notes, onBeat, { beats, step }) : onBeat;
  const band = BANDS[color];
  const lanes = mapLanes(filtered, band);
  if (!ACCENTS.has(color)) {
    return {
      band,
      notes: filtered.map((note, at) => ({ t: note.t, lanes: [lanes[at] ?? DOT], holdSec: 0 })),
      phrases: childPhrases(facts.phrases, filtered),
    };
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
    phrases: childPhrases(facts.phrases, filtered),
  };
};
