import { describe, expect, it } from 'vitest';
import { childChart, type SongFacts } from '../index';

type FactsNote = SongFacts['notes'][number];

/** 4 bars of 4/4 with 0.5 s beats. */
const BEATS: SongFacts['beats'] = Array.from({ length: 16 }, (_, at) => ({ t: at / 2, downbeat: at % 4 === 0 }));

const factsWith = (notes: FactsNote[]): SongFacts => ({
  version: 1,
  id: 'test-tune',
  title: 'Test Tune',
  artist: 'The Testers',
  charter: 'Nobody',
  beats: BEATS,
  notes,
  fills: [],
  phrases: [],
  phraseSource: 'fallback',
});

/** A note on each beat from 0 s with these frets. */
const onBeats = (frets: readonly number[][]): FactsNote[] =>
  frets.map((fret, at) => ({ t: at / 2, frets: fret, lenSec: 0 }));

const lanesOf = (notes: FactsNote[], color: 'silver' | 'gold' = 'gold'): number[][] =>
  childChart(factsWith(notes), { color, step: 2 }).notes.map((note) => note.lanes);

describe('childChart doubles', () => {
  it('makes a chord on a downbeat a double on Pip + Dot from Dot, and keeps a chord off the downbeat single', () => {
    expect(lanesOf(onBeats([[0, 1], [0, 1], [0]]))).toEqual([[0, 1], [1], [1]]);
  });

  it('gives Dot + Bo from Dot when the highest fret is 3 or 4', () => {
    expect(lanesOf(onBeats([[2, 4]]))).toEqual([[1, 2]]);
    expect(lanesOf(onBeats([[7, 3]]))).toEqual([[1, 2]]);
  });

  it('gives Pip + Dot from Pip and Dot + Bo from Bo', () => {
    // Dot, Dot, then down to Pip, Pip; the chord on the downbeat at 2 s stays on Pip.
    const down = onBeats([[2], [2], [1], [1], [0, 4]]);
    expect(lanesOf(down).at(-1)).toEqual([0, 1]);
    const up = onBeats([[0], [0], [1], [1], [2, 3]]);
    expect(lanesOf(up).at(-1)).toEqual([1, 2]);
  });

  it('makes a downbeat chord a double only when none of the 3 notes before it is a double', () => {
    // Chords on every beat for 3 bars of 4 beats: the doubles fall on the downbeats at 0 s, 2 s and 4 s.
    const notes = onBeats(Array.from({ length: 12 }, () => [0, 1]));
    const doubles = lanesOf(notes).flatMap((lanes, at) => (lanes.length === 2 ? [at] : []));
    expect(doubles).toEqual([0, 4, 8]);
    // With chords on beats 1 and 3 of a bar only at step 0, the 3-note rule drops every second downbeat chord.
    const sparse = childChart(factsWith(notes), { color: 'gold', step: 0 }).notes.map((note) => note.lanes.length);
    expect(sparse).toEqual([2, 1, 1, 1, 2, 1]);
  });

  it('makes no double below gold', () => {
    expect(lanesOf(onBeats([[0, 1]]), 'silver')).toEqual([[1]]);
  });
});

const holdsOf = (notes: FactsNote[], color: 'silver' | 'gold' = 'gold'): number[] =>
  childChart(factsWith(notes), { color, step: 2 }).notes.map((note) => note.holdSec);

describe('childChart holds', () => {
  it('cuts a sustain at the next note minus its good window', () => {
    // The next note is 2 s later: its good window is 0.25 s, so the hold ends at 1.75 s.
    expect(
      holdsOf([
        { t: 0, frets: [0], lenSec: 3 },
        { t: 2, frets: [0], lenSec: 0 },
      ])
    ).toEqual([1.75, 0]);
  });

  it('keeps a sustain whole when it ends before the cut', () => {
    expect(
      holdsOf([
        { t: 0, frets: [0], lenSec: 1 },
        { t: 2, frets: [0], lenSec: 0 },
      ])
    ).toEqual([1, 0]);
  });

  it('makes a hold only of a sustain of one beat or more after the cut', () => {
    // A beat is 0.5 s. The next note 0.5 s later cuts the sustain to 0.275 s: a plain note.
    expect(
      holdsOf([
        { t: 0, frets: [0], lenSec: 2 },
        { t: 0.5, frets: [0], lenSec: 0.5 },
      ])
    ).toEqual([0, 0.5]);
    expect(holdsOf([{ t: 0, frets: [0], lenSec: 0.4375 }])).toEqual([0]);
  });

  it('makes no hold below gold', () => {
    expect(holdsOf([{ t: 0, frets: [0], lenSec: 1 }], 'silver')).toEqual([0]);
  });
});

describe('childChart at platinum', () => {
  it('keeps the doubles and the soft holds of gold', () => {
    const notes = [
      { t: 0, frets: [0, 4], lenSec: 0 },
      { t: 0.5, frets: [1], lenSec: 1 },
      { t: 2, frets: [1], lenSec: 0 },
    ];
    const chart = childChart(factsWith(notes), { color: 'platinum', step: 2 }).notes;
    expect(chart.some((note) => note.lanes.length === 2)).toBe(true);
    expect(chart.some((note) => note.holdSec > 0)).toBe(true);
  });
});
