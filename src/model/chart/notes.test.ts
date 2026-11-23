import { describe, expect, it } from 'vitest';
import { readChart } from '../index';
import chords from './fixtures/chords.chart?raw';
import { factsOf, META } from './fixtures/facts-of';
import hardTop from './fixtures/hard-top.chart?raw';
import noGuitar from './fixtures/no-guitar.chart?raw';

describe('readChart notes', () => {
  it('makes one chord of the notes on one tick, keeps open notes, and drops the flags', () => {
    expect(factsOf(chords).notes).toEqual([
      { t: 0, frets: [0, 2], lenSec: 0 },
      { t: 0.5, frets: [7], lenSec: 0 },
      { t: 1, frets: [1, 3], lenSec: 0.5 },
      { t: 1.5, frets: [4], lenSec: 0 },
    ]);
  });

  it('takes the lead guitar at the highest difficulty that has notes', () => {
    expect(factsOf(hardTop).notes).toEqual([{ t: 1, frets: [1], lenSec: 0 }]);
  });

  it('gives the song values from the metadata and no fills', () => {
    expect(factsOf(chords)).toMatchObject({
      version: 1,
      id: 'test-tune',
      title: 'Test Tune',
      artist: 'The Testers',
      charter: 'Nobody',
      fills: [],
    });
  });
});

describe('readChart refusals', () => {
  it('refuses a song with no lead guitar', () => {
    expect(readChart(noGuitar, META)).toEqual({ ok: false, reason: 'The chart has no lead guitar notes.' });
  });

  it('refuses a chart with no resolution', () => {
    const result = readChart('[Song]\n{\n  Name = "Test Tune"\n}\n', META);

    expect(result).toEqual({ ok: false, reason: 'The chart has no Resolution in its [Song] section.' });
  });
});
