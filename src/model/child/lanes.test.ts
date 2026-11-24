import { describe, expect, it } from 'vitest';
import { childChart, type RecordColor, type SongFacts } from '../index';

const OPEN = 7;

/** Facts with a beat every `beatSec` seconds and one note on each beat, with these frets (one array per note). */
const melody = (frets: readonly (readonly number[])[], beatSec = 0.5): SongFacts => ({
  version: 1,
  id: 'test-tune',
  title: 'Test Tune',
  artist: 'The Testers',
  charter: 'Nobody',
  beats: frets.map((_, at) => ({ t: at * beatSec, downbeat: at % 4 === 0 })),
  notes: frets.map((note, at) => ({ t: at * beatSec, frets: [...note], lenSec: 0 })),
  fills: [],
  phrases: [],
  phraseSource: 'fallback',
});

/** The lane of each child note at step 2 (every beat). */
const lanesOf = (facts: SongFacts, color: RecordColor): number[] =>
  childChart(facts, color, 2).notes.map((note) => note.lanes[0]);

const single = (frets: readonly number[]): number[][] => frets.map((fret) => [fret]);

describe('childChart lane mapping', () => {
  it('starts on Dot and changes lane with the contour after 2 notes in a lane', () => {
    expect(lanesOf(melody(single([2, 2, 3, 3, 4, 1, 0, 0])), 'silver')).toEqual([1, 1, 2, 2, 2, 1, 1, 1]);
  });

  it('keeps the lane after only 1 note in it, when the gap is short', () => {
    // The 2nd note goes up, but Dot has only 1 note: it stays. The 3rd goes up again after 2 notes on Dot.
    expect(lanesOf(melody(single([1, 2, 3])), 'silver')).toEqual([1, 1, 2]);
  });

  it('changes lane after a gap of 1.2 s or more, even after 1 note in the lane', () => {
    expect(lanesOf(melody(single([1, 2, 3]), 1.2), 'silver')).toEqual([1, 2, 2]);
    expect(lanesOf(melody(single([1, 2, 3]), 1.1), 'silver')).toEqual([1, 1, 2]);
  });

  it('stays in the edge lane on a move past it', () => {
    expect(lanesOf(melody(single([0, 1, 2, 3, 4, 4])), 'silver')).toEqual([1, 1, 2, 2, 2, 2]);
  });

  it('never jumps from Pip to Bo or from Bo to Pip, even after a long gap', () => {
    const lanes = lanesOf(melody(single([2, 4, 0, 4, 0]), 2), 'silver');
    expect(lanes).toEqual([1, 2, 1, 2, 1]);
    lanes.slice(1).forEach((lane, at) => expect(Math.abs(lane - (lanes[at] ?? lane))).toBeLessThanOrEqual(1));
  });

  it('counts an open note below fret 0 and a chord as its lowest fret', () => {
    // Open after green goes down; the chord [3, 1] counts as fret 1, so it is higher than the open note.
    expect(lanesOf(melody([[0], [0], [OPEN], [OPEN], [3, 1], [3, 1]]), 'silver')).toEqual([1, 1, 0, 0, 1, 1]);
  });

  it('uses only Pip and Dot at bronze', () => {
    expect(lanesOf(melody(single([1, 1, 3, 3, 0, 0])), 'bronze')).toEqual([1, 1, 1, 1, 0, 0]);
  });

  it('puts every note on Dot at level 0', () => {
    expect(lanesOf(melody(single([1, 1, 3, 3, 0, 0])), 'none')).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('uses all 3 lanes at silver', () => {
    expect(new Set(lanesOf(melody(single([2, 2, 4, 4, 1, 1, 0])), 'silver'))).toEqual(new Set([0, 1, 2]));
  });
});
