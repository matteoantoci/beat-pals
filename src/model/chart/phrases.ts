// The phrases of a song (spec, "The facts file"): the Star Power phrases of the lead guitar part that the facts use.
// A chart with no Star Power phrase gets a phrase every 8 bars at a section start instead. Phrases never overlap.
// All in ticks; `buildFacts` turns them into song times.

import type { BeatTick } from './beats';

/** A tick range: from `start` (included) to `end` (not included). */
export type TickRange = { readonly start: number; readonly end: number };

/** A Star Power phrase as a chart gives it: its start tick and its length in ticks. */
export type StarPower = { readonly tick: number; readonly length: number };

/** Where the phrases come from: the Star Power phrases of the chart, or the rule for a chart with none. */
export type PhraseSource = 'chart' | 'fallback';

/** The fallback phrases start this many bars apart, and not in the first bars from the first note (a first value). */
const FALLBACK_BARS = 8;
/** A fallback phrase lasts this many bars (a first value). */
const FALLBACK_LENGTH_BARS = 2;

/** The phrases in time order, each one starting at or after the end of the phrase before. */
const apart = (ranges: readonly TickRange[]): TickRange[] =>
  ranges
    .toSorted((a, b) => a.start - b.start)
    .reduce<TickRange[]>(
      (kept, range) =>
        range.end > range.start && range.start >= (kept.at(-1)?.end ?? Number.NEGATIVE_INFINITY)
          ? kept.concat(range)
          : kept,
      []
    );

/** The index of the downbeat nearest to `tick`. At equal distance, the earlier one. */
const nearestBar = (downbeats: readonly number[], tick: number): number =>
  downbeats.reduce(
    (best, at, index) => (Math.abs(at - tick) < Math.abs((downbeats[best] ?? 0) - tick) ? index : best),
    0
  );

/**
 * The fallback phrases. The bar of the first note is the last downbeat at or before it. The candidates are the bars
 * of the section markers (each snapped to its nearest downbeat), or with no section marker every 8th bar from the bar
 * of the first note. A candidate becomes a phrase when it is at least 8 bars after the bar of the first note and at
 * least 8 bars after the start of the phrase before. A phrase lasts 2 bars, or up to the end of the chart.
 */
const fallbackPhrases = (
  beats: readonly BeatTick[],
  { firstNote, sections, endTick }: { firstNote: number; sections: readonly number[]; endTick: number }
): TickRange[] => {
  const downbeats = beats.filter((beat) => beat.downbeat).map((beat) => beat.tick);
  const firstBar = Math.max(
    0,
    downbeats.findLastIndex((tick) => tick <= firstNote)
  );
  const candidates =
    sections.length > 0
      ? sections.map((tick) => nearestBar(downbeats, tick)).toSorted((a, b) => a - b)
      : Array.from(
          { length: Math.floor((downbeats.length - firstBar) / FALLBACK_BARS) },
          (_, k) => firstBar + (k + 1) * FALLBACK_BARS
        );
  const starts = candidates.reduce<number[]>(
    (kept, bar) =>
      bar >= Math.max(firstBar, kept.at(-1) ?? Number.NEGATIVE_INFINITY) + FALLBACK_BARS ? kept.concat(bar) : kept,
    []
  );
  return starts.flatMap((bar) => {
    const start = downbeats[bar] ?? endTick;
    const end = Math.min(endTick, downbeats[bar + FALLBACK_LENGTH_BARS] ?? endTick);
    return end > start ? [{ start, end }] : [];
  });
};

/** The phrases of a chart and their source. Overlapping Star Power phrases keep the earlier one. */
export const phraseTicks = (
  starPower: readonly StarPower[],
  fallback: {
    readonly beats: readonly BeatTick[];
    readonly firstNote: number;
    readonly sections: readonly number[];
    readonly endTick: number;
  }
): { source: PhraseSource; ranges: TickRange[] } => {
  const chart = apart(starPower.map(({ tick, length }) => ({ start: tick, end: tick + length })));
  return chart.length > 0
    ? { source: 'chart', ranges: chart }
    : { source: 'fallback', ranges: apart(fallbackPhrases(fallback.beats, fallback)) };
};
