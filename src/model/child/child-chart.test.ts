import { describe, expect, it } from 'vitest';
import { childChart, readChart, RECORD_COLORS, type SongFacts, type SpeedStep } from '../index';
import steady120 from './fixtures/steady-120.chart?raw';
import steady136 from './fixtures/steady-136.chart?raw';

const META = { id: 'test-tune', name: 'Test Tune', artist: 'The Testers', charter: 'Nobody', delay: 0 };

/** The facts of a .chart fixture. Fails the test on a refusal. */
const factsOf = (text: string): SongFacts => {
  const result = readChart(text, META);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.facts;
};

const STEPS: readonly SpeedStep[] = [0, 1, 2];

type Beat = SongFacts['beats'][number];

type Meter = { perBar?: number; pickup?: number };

/** Steady beats: `bars` bars of `perBar` beats of `beatSec` seconds, after `pickup` beats before the first bar. */
const steadyBeats = (beatSec: number, bars: number, { perBar = 4, pickup = 0 }: Meter = {}): Beat[] =>
  Array.from({ length: pickup + bars * perBar }, (_, at) => ({
    t: at * beatSec,
    downbeat: at >= pickup && (at - pickup) % perBar === 0,
  }));

/** Facts with these beats, a single green note at each time of `notes`, and `fills`. */
const factsWith = (beats: Beat[], notes: readonly number[], fills: SongFacts['fills'] = []): SongFacts => ({
  version: 1,
  id: META.id,
  title: META.name,
  artist: META.artist,
  charter: META.charter,
  beats,
  notes: notes.map((t) => ({ t, frets: [0], lenSec: 0 })),
  fills,
});

/** The note times of the child chart at level 0 (no record), with a note on each beat of the facts. */
const onEveryBeat = (beats: Beat[], step: SpeedStep): number[] => {
  const facts = factsWith(
    beats,
    beats.map((beat) => beat.t)
  );
  return childChart(facts, 'none', step).notes.map((note) => note.t);
};

/** Notes on beats 2 and 4 of 0.5 s beats, from 0.5 s on: beats that step 0 does not keep. */
const offStep = (count: number): number[] => Array.from({ length: count }, (_, at) => 0.5 + at);

describe('childChart speed steps', () => {
  // 4 bars of 4/4 with a note on each eighth note.
  it.each([
    ['120 BPM', steady120],
    ['136 BPM', steady136],
  ])('gives strictly more notes at each step than at the step below, at %s', (_tempo, text) => {
    const facts = factsOf(text);
    const counts = STEPS.map((step) => childChart(facts, 'none', step).notes.length);
    expect(counts).toEqual([8, 12, 16]);
  });
  it('keeps beats 1 and 3 at step 0, beats 1 to 3 at step 1, and every beat at step 2 in 4/4', () => {
    const beats = steadyBeats(0.5, 2);
    expect(onEveryBeat(beats, 0)).toEqual([0, 1, 2, 3]);
    expect(onEveryBeat(beats, 1)).toEqual([0, 0.5, 1, 2, 2.5, 3]);
    expect(onEveryBeat(beats, 2)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  });

  it('keeps beats 1 and 3 at step 0 and beats 1 and 2 at step 1 in 3/4', () => {
    const beats = steadyBeats(0.5, 2, { perBar: 3 });
    expect(onEveryBeat(beats, 0)).toEqual([0, 1, 1.5, 2.5]);
    expect(onEveryBeat(beats, 1)).toEqual([0, 0.5, 1.5, 2]);
    expect(onEveryBeat(beats, 2)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
  });

  it('counts half notes as beats and 2 bars as one bar when a beat is shorter than 0.43 s', () => {
    // 3 bars of 0.375 s beats (160 BPM). Bars 1 and 2 count as one bar of 4 half notes. Bar 3 counts alone.
    const beats = steadyBeats(0.375, 3);
    expect(onEveryBeat(beats, 0)).toEqual([0, 1.5, 3]);
    expect(onEveryBeat(beats, 1)).toEqual([0, 0.75, 1.5, 3]);
    expect(onEveryBeat(beats, 2)).toEqual([0, 0.75, 1.5, 2.25, 3, 3.75]);
  });

  it('counts every beat when a beat is 0.43 s or longer', () => {
    expect(onEveryBeat(steadyBeats(0.4375, 1), 2)).toEqual([0, 0.4375, 0.875, 1.3125]);
  });

  it('keeps no beat before the first downbeat', () => {
    expect(onEveryBeat(steadyBeats(0.5, 1, { pickup: 2 }), 2)).toEqual([1, 1.5, 2, 2.5]);
  });
});

describe('childChart filter', () => {
  // Beats of 1 s, so a note is on a beat within 0.1 s of it.
  const beats = steadyBeats(1, 1);
  const timesOf = (notes: readonly number[], fills: SongFacts['fills'] = []): number[] =>
    childChart(factsWith(beats, notes, fills), 'none', 2).notes.map((note) => note.t);

  it('takes a note within 10% of a beat length of a kept beat and drops the notes between the beats', () => {
    expect(timesOf([0.1, 0.5, 1.125, 2.75, 2.875, 3.0625])).toEqual([0.1, 3.0625]);
  });

  it('takes the nearest note on each kept beat, and the earlier note at equal distance', () => {
    expect(timesOf([0.9375, 1.03125, 1.9375, 2.0625])).toEqual([1.03125, 1.9375]);
  });

  it('lets the notes of the fills join the guitar notes', () => {
    const fills: SongFacts['fills'] = [{ part: 'bass', notes: [{ t: 2, frets: [7], lenSec: 0 }] }];
    expect(timesOf([1, 3], fills)).toEqual([1, 2, 3]);
  });

  describe('refill of long gaps', () => {
    // 7 bars of 0.5 s beats at step 0: the kept beats are 1 and 3 of each bar, 1 s apart.
    const slowBeats = steadyBeats(0.5, 7);
    const stepZero = (notes: readonly number[]): number[] =>
      childChart(factsWith(slowBeats, notes), 'none', 0).notes.map((note) => note.t);

    it('lets the dropped notes on a beat join a gap of more than 8 s, at the spacing of the kept beats', () => {
      // 1.25 is on no beat, so it never joins.
      const refilled = [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5];
      expect(stepZero([0, ...offStep(11), 1.25, 12].toSorted((a, b) => a - b))).toEqual([0, ...refilled, 12]);
    });

    it('keeps a gap of 8 s as it is', () => {
      expect(stepZero([0, ...offStep(7), 8])).toEqual([0, 8]);
    });
  });
});

describe('childChart notes and band', () => {
  it('gives a plain note on Dot for each note at level 0', () => {
    const facts = factsWith(steadyBeats(0.5, 1), [0, 1]);
    expect(childChart(facts, 'none', 0)).toEqual({
      band: [1],
      notes: [
        { t: 0, lanes: [1], holdSec: 0 },
        { t: 1, lanes: [1], holdSec: 0 },
      ],
    });
  });

  it('puts Dot in the band at level 0, Pip at bronze, and Bo from silver on', () => {
    const facts = factsWith(steadyBeats(0.5, 1), [0]);
    const bands = RECORD_COLORS.map((color) => childChart(facts, color, 0).band);
    expect(bands).toEqual([[1], [0, 1], [0, 1, 2], [0, 1, 2], [0, 1, 2]]);
  });
});
