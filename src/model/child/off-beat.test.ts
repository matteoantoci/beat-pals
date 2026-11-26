import { describe, expect, it } from 'vitest';
import { childChart, RECORD_COLORS, type SongFacts, type SpeedStep } from '../index';

type Beat = SongFacts['beats'][number];

/** Steady 4/4 beats: `bars` bars of beats of `beatSec` seconds. */
const steadyBeats = (beatSec: number, bars: number): Beat[] =>
  Array.from({ length: bars * 4 }, (_, at) => ({ t: at * beatSec, downbeat: at % 4 === 0 }));

/** Facts with these beats and a single green note at each time of `notes`. */
const factsWith = (beats: Beat[], notes: readonly number[]): SongFacts => ({
  version: 1,
  id: 'test-tune',
  title: 'Test Tune',
  artist: 'The Testers',
  charter: 'Nobody',
  beats,
  notes: notes.map((t) => ({ t, frets: [0], lenSec: 0 })),
  fills: [],
  phrases: [],
  phraseSource: 'fallback',
});

describe('childChart off-beat notes at platinum', () => {
  it('lets an off-beat note join only with a gap of at least 0.43 s to each accepted note', () => {
    // Beats of 2 s: 2.4 is 0.4 s after a beat note, 3.3 is 0.3 s after the off-beat note at 3, and 5.6 is 0.4 s
    // before a beat note.
    const facts = factsWith(steadyBeats(2, 1), [0, 2, 2.4, 3, 3.3, 4, 5.6, 6]);
    expect(childChart(facts, { color: 'platinum', step: 2 }).notes.map((note) => note.t)).toEqual([0, 2, 3, 4, 6]);
  });

  it('lets an off-beat note join at exactly 0.43 s', () => {
    const facts = factsWith(steadyBeats(2, 1), [0, 2, 2.43, 4, 6]);
    expect(childChart(facts, { color: 'platinum', step: 2 }).notes.map((note) => note.t)).toEqual([0, 2, 2.43, 4, 6]);
  });

  it('lets an off-beat note join at 0.43 s when the float difference comes out a little short', () => {
    // 10.43 - 10 is 0.4299999999999997 in floating point.
    const facts = factsWith(steadyBeats(2, 2), [8, 10, 10.43, 12, 14]);
    expect(childChart(facts, { color: 'platinum', step: 2 }).notes.map((note) => note.t)).toEqual([
      8, 10, 10.43, 12, 14,
    ]);
  });

  it.each([
    [0, 0.2],
    [1, 0.35],
    [2, 0.5],
  ] as const)('keeps the off-beat share at or below the cap at step %i (%f)', (step: SpeedStep, cap) => {
    // Beats of 1 s with a note on each beat and one in the middle of each beat.
    const beats = steadyBeats(1, 10);
    const facts = factsWith(
      beats,
      beats.flatMap((beat) => [beat.t, beat.t + 0.5])
    );
    const notes = childChart(facts, { color: 'platinum', step }).notes.map((note) => note.t);
    const offShares = notes.map(
      (_, at) => notes.slice(0, at + 1).filter((t) => !Number.isInteger(t)).length / (at + 1)
    );
    expect(Math.max(...offShares)).toBeLessThanOrEqual(cap);
    expect(offShares.at(-1)).toBeGreaterThan(cap - 0.1);
  });

  it('adds no off-beat note below platinum', () => {
    const facts = factsWith(steadyBeats(1, 2), [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    RECORD_COLORS.filter((color) => color !== 'platinum').forEach((color) => {
      expect(childChart(facts, { color, step: 2 }).notes.every((note) => Number.isInteger(note.t))).toBe(true);
    });
  });
});
