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
  phrases: [],
  phraseSource: 'fallback',
});

/** The note times of the child chart at level 0 (no record), with a note on each beat of the facts. */
const onEveryBeat = (beats: Beat[], step: SpeedStep): number[] => {
  const facts = factsWith(
    beats,
    beats.map((beat) => beat.t)
  );
  return childChart(facts, { color: 'none', step }).notes.map((note) => note.t);
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
    const counts = STEPS.map((step) => childChart(facts, { color: 'none', step }).notes.length);
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

  it('rests on the last counted beat of each bar where every counted beat has a note, at level 0 only', () => {
    // Bar 1 has a note on each beat. Bar 2 has no note on beat 3, so the guitar already rests there.
    const facts = factsWith(steadyBeats(0.5, 2), [0, 0.5, 1, 1.5, 2, 2.5, 3.5]);
    const times = (rests: boolean): number[] =>
      childChart(facts, { color: 'none', step: 2, rests }).notes.map((note) => note.t);
    expect(times(true)).toEqual([0, 0.5, 1, 2, 2.5, 3.5]);
    expect(times(false)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3.5]);
  });
});

describe('childChart filter', () => {
  // Beats of 1 s, so a note is on a beat within 0.1 s of it.
  const beats = steadyBeats(1, 1);
  const timesOf = (notes: readonly number[], fills: SongFacts['fills'] = []): number[] =>
    childChart(factsWith(beats, notes, fills), { color: 'none', step: 2 }).notes.map((note) => note.t);

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
      childChart(factsWith(slowBeats, notes), { color: 'none', step: 0 }).notes.map((note) => note.t);

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
    expect(childChart(facts, { color: 'none', step: 0 })).toEqual({
      band: [1],
      notes: [
        { t: 0, lanes: [1], holdSec: 0 },
        { t: 1, lanes: [1], holdSec: 0 },
      ],
      phrases: [],
    });
  });

  it('puts Dot in the band at level 0, Pip at bronze, and Bo from silver on', () => {
    const facts = factsWith(steadyBeats(0.5, 1), [0]);
    const bands = RECORD_COLORS.map((color) => childChart(facts, { color, step: 0 }).band);
    expect(bands).toEqual([[1], [0, 1], [0, 1, 2], [0, 1, 2], [0, 1, 2]]);
  });
});

/** Facts with a beat and a note each second for 64 s, and these phrases. Every beat is a child note at step 2. */
const everySecond = (phrases: SongFacts['phrases']): SongFacts => ({
  ...factsWith(
    steadyBeats(1, 16),
    Array.from({ length: 64 }, (_, at) => at)
  ),
  phrases,
});

describe('childChart phrases', () => {
  it('gives each phrase the child notes in its time range, from its start up to before its end', () => {
    const facts = {
      ...factsWith(steadyBeats(0.5, 4), [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]),
      phrases: [{ t: 0.5, end: 2.5 }],
    };
    expect(childChart(facts, { color: 'none', step: 2 }).phrases).toEqual([{ first: 1, last: 4 }]);
  });

  it('grows a phrase with fewer than 4 child notes to 4, and drops it when the next phrase leaves no room', () => {
    const facts = everySecond([
      { t: 2, end: 3.5 },
      { t: 40, end: 41 },
      { t: 42, end: 46 },
    ]);
    expect(childChart(facts, { color: 'none', step: 2 }).phrases).toEqual([
      { first: 2, last: 5 },
      { first: 42, last: 45 },
    ]);
  });

  it('drops a phrase that starts less than 30 s after the last note of the phrase before', () => {
    const facts = everySecond([
      { t: 0, end: 4 },
      { t: 30, end: 34 },
      { t: 36, end: 40 },
    ]);
    expect(childChart(facts, { color: 'none', step: 2 }).phrases).toEqual([
      { first: 0, last: 3 },
      { first: 36, last: 39 },
    ]);
  });

  it('keeps a phrase at a slow speed step by growing it over the notes of that step', () => {
    const facts = everySecond([{ t: 4, end: 6 }]);
    // Step 0 keeps beats 1 and 3 of each bar: 0, 2, 4, 6, and so on.
    expect(childChart(facts, { color: 'bronze', step: 0 }).phrases).toEqual([{ first: 2, last: 5 }]);
  });
});
