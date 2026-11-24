// The star moments of a play (spec, "Star moments"). When the last note of a phrase is hit or passes, the phrase
// gives a star moment if at least 75% of its notes were hit. A missed phrase costs nothing.

import type { ChildChart } from '../child/child-chart';
import type { PlayState } from './play';
import type { PlayEvent } from './play-events';

/** A phrase gives a star moment when at least this share of its notes were hit (a first value). */
const STAR_SHARE = 0.75;

/** For each note of the chart, the index of the phrase that ends with it, or -1. */
export const phraseEnds = (chart: ChildChart): number[] =>
  chart.notes.map((_, at) => chart.phrases.findIndex((phrase) => phrase.last === at));

/**
 * The star moment of the phrase that ends with note `at`, which was just hit or passed. The notes before it are
 * decided then: their good windows end before the window of `at` starts.
 */
export const starEvents = (play: PlayState, at: number): PlayEvent[] => {
  const phrase = play.phraseEnds[at] ?? -1;
  const range = play.chart.phrases[phrase];
  if (range === undefined) {
    return [];
  }
  const hits = play.hit.slice(range.first, range.last + 1).filter(Boolean).length;
  return hits >= STAR_SHARE * (range.last - range.first + 1) ? [{ type: 'starMoment', phrase }] : [];
};
