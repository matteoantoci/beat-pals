// The facts file of a song (spec, "The facts file"): the facts of the chart, with all times in seconds
// and the delay applied, so the game needs no tick math. Each chart format reads its file into a
// `TickChart`, and `buildFacts` makes the facts from it.

import { beatTicks, type BeatTick, type TimeSignature } from './beats';
import { phraseTicks, type PhraseSource, type StarPower } from './phrases';
import { tickClock, type Tempo } from './tempo';

/** A chord or a single note. `frets` 0 to 4 are green to orange, and 7 is open. */
type FactsNote = { t: number; frets: number[]; lenSec: number };

export type SongFacts = {
  version: 1;
  id: string;
  title: string;
  artist: string;
  charter: string;
  beats: { t: number; downbeat: boolean }[];
  /** The lead guitar at its highest difficulty. */
  notes: FactsNote[];
  /** The notes of other parts that fill the long rests of the lead guitar. */
  fills: { part: FillPart; notes: FactsNote[] }[];
  /** The phrases for the star moments, in time order, apart: from `t` (included) to `end` (not included). */
  phrases: { t: number; end: number }[];
  /** `chart`: the Star Power phrases of the lead guitar. `fallback`: the chart has none, so a rule made them. */
  phraseSource: PhraseSource;
};

/** The parts that fill a long guitar rest, in the order of choice. */
const FILL_PARTS = ['bass', 'keys', 'drums'] as const;

type FillPart = (typeof FILL_PARTS)[number];

/** The song values that the caller gives, from the metadata pairs of the song. `delay` is in milliseconds. */
export type SongMeta = { id: string; name: string; artist: string; charter: string; delay: number };

/** The facts, or the reason why the song is refused. */
export type ChartResult = { ok: true; facts: SongFacts } | { ok: false; reason: string };

/** One fret of a part at one tick, with its sustain length in ticks. */
export type TickNote = { tick: number; fret: number; length: number };

/** A chart in ticks, as a chart format gives it. */
export type TickChart = {
  /** The ticks in a quarter note. */
  resolution: number;
  /** The `Offset` of a .chart file in seconds. The chart delay when the metadata delay is 0. */
  offsetSec: number;
  tempos: readonly Tempo[];
  timeSignatures: readonly TimeSignature[];
  /** The lead guitar at its highest difficulty. Undefined when the chart has no lead guitar. */
  guitar: readonly TickNote[] | undefined;
  /** The other parts, each at its highest difficulty (drum pads already as frets). Undefined when a part has no notes. */
  parts: Readonly<Record<FillPart, readonly TickNote[] | undefined>>;
  /** The beats of a beat track (a .mid `BEAT` track). Undefined when the chart has none: then the time signatures give the beats. */
  beats: readonly BeatTick[] | undefined;
  /** The last tick of the chart. The beats from time signatures continue to the end of its bar. */
  endTick: number;
  /** The Star Power phrases of the lead guitar, at the difficulty of `guitar`. */
  starPower: readonly StarPower[];
  /** The ticks of the section markers of the chart. */
  sections: readonly number[];
};

const MS_PER_SECOND = 1000;

/** A guitar rest longer than this gets a fill (a first value to tune). */
const LONG_REST_SEC = 8;

/** Times keep 6 decimals (microseconds), so the facts file has no float noise. */
const round = (sec: number): number => Math.round(sec * 1e6) / 1e6;

/** Notes on the same tick form one chord. A chord keeps the longest sustain of its notes. */
const chords = (notes: readonly TickNote[], seconds: (tick: number) => number, delay: number): FactsNote[] => {
  const byTick = new Map<number, TickNote[]>();
  notes.forEach((note) => byTick.set(note.tick, [...(byTick.get(note.tick) ?? []), note]));
  return [...byTick]
    .toSorted(([a], [b]) => a - b)
    .map(([tick, chord]) => ({
      t: round(seconds(tick) + delay),
      frets: [...new Set(chord.map((note) => note.fret))].toSorted((a, b) => a - b),
      lenSec: round(Math.max(...chord.map((note) => seconds(note.tick + note.length))) - seconds(tick)),
    }));
};

/** A tick range of a fill: from `start` (included) to `stop` (not included). */
type Window = { start: number; stop: number };

/**
 * The fill windows of the long guitar rests. A rest runs from the end of a guitar note (or tick 0) to the next guitar
 * note. Its window starts 1 beat after the end of the note (or at tick 0) and stops 1 beat before the next note.
 * A rest after the last note gets no window.
 */
const fillWindows = (guitar: readonly TickNote[], seconds: (tick: number) => number, beat: number): Window[] => {
  const windows: Window[] = [];
  let end: number | undefined;
  guitar
    .toSorted((a, b) => a.tick - b.tick)
    .forEach((note) => {
      if (seconds(note.tick) - seconds(end ?? 0) > LONG_REST_SEC) {
        windows.push({ start: end === undefined ? 0 : end + beat, stop: note.tick - beat });
      }
      end = Math.max(end ?? 0, note.tick + note.length);
    });
  return windows;
};

/** The fill of one window: the notes of the first part with notes in it. A sustain stops at the end of the window. */
const fillOf = (
  parts: TickChart['parts'],
  { start, stop }: Window
): { part: FillPart; notes: TickNote[] } | undefined =>
  FILL_PARTS.map((part) => ({
    part,
    notes: (parts[part] ?? [])
      .filter((note) => note.tick >= start && note.tick < stop)
      .map(({ tick, fret, length }) => ({ tick, fret, length: Math.min(length, stop - tick) })),
  })).find((fill) => fill.notes.length > 0);

/** The facts of a chart. The metadata `delay` applies when it is not 0, else the chart `Offset`. */
export const buildFacts = (chart: TickChart, meta: SongMeta): ChartResult => {
  if (chart.guitar === undefined) {
    return { ok: false, reason: 'The chart has no lead guitar notes.' };
  }
  const seconds = tickClock(chart.tempos, chart.resolution);
  const delay = meta.delay === 0 ? chart.offsetSec : meta.delay / MS_PER_SECOND;
  const beatSource = chart.beats ?? beatTicks(chart.timeSignatures, chart.resolution, chart.endTick);
  const phrases = phraseTicks(chart.starPower, {
    beats: beatSource,
    firstNote: Math.min(...chart.guitar.map((note) => note.tick)),
    sections: chart.sections,
    endTick: chart.endTick,
  });
  const beats = beatSource.map(({ tick, downbeat }) => ({
    t: round(seconds(tick) + delay),
    downbeat,
  }));
  const facts: SongFacts = {
    version: 1,
    id: meta.id,
    title: meta.name,
    artist: meta.artist,
    charter: meta.charter,
    beats,
    notes: chords(chart.guitar, seconds, delay),
    fills: fillWindows(chart.guitar, seconds, chart.resolution).flatMap((window) => {
      const fill = fillOf(chart.parts, window);
      return fill === undefined ? [] : [{ part: fill.part, notes: chords(fill.notes, seconds, delay) }];
    }),
    phrases: phrases.ranges.map(({ start, end }) => ({
      t: round(seconds(start) + delay),
      end: round(seconds(end) + delay),
    })),
    phraseSource: phrases.source,
  };
  return { ok: true, facts };
};
