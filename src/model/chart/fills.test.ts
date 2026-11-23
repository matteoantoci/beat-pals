import { describe, expect, it } from 'vitest';
import { readSongChart, type SongFacts } from '../index';
import drumFill from './fixtures/drum-fill.chart?raw';
import { factsOf, META } from './fixtures/facts-of';
import longRests from './fixtures/long-rests.chart?raw';
import { midFile, note, RES, TEMPO_TRACK, trackName } from './fixtures/mid';

const factsOfMid = (bytes: Uint8Array): SongFacts => {
  const result = readSongChart({ mid: bytes }, META);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.facts;
};

const track = (name: string, ...notes: Parameters<typeof note>[]) => [
  trackName(name),
  ...notes.flatMap((args) => note(...args)),
];

describe('fills of long guitar rests in a .chart file', () => {
  it('fills each long rest from bass, else keys, from 1 beat after to 1 beat before, and not after the last note', () => {
    expect(factsOf(longRests).fills).toEqual([
      {
        part: 'bass',
        notes: [
          { t: 0.5, frets: [1], lenSec: 0 },
          { t: 5, frets: [2, 4], lenSec: 0 },
          { t: 9, frets: [3], lenSec: 0.5 },
        ],
      },
      { part: 'keys', notes: [{ t: 15, frets: [4], lenSec: 0 }] },
    ]);
  });

  it('keeps the guitar notes unchanged', () => {
    expect(factsOf(longRests).notes.map((each) => each.t)).toEqual([0, 10, 20, 21]);
  });

  it('fills a rest from time 0 with drums: pads from red at fret 0, and the kick as open', () => {
    expect(factsOf(drumFill).fills).toEqual([
      {
        part: 'drums',
        notes: [
          { t: 1, frets: [0, 7], lenSec: 0 },
          { t: 2, frets: [1], lenSec: 0 },
          { t: 3, frets: [2], lenSec: 0 },
          { t: 4, frets: [3], lenSec: 0 },
          { t: 5, frets: [4], lenSec: 0 },
          { t: 6, frets: [7], lenSec: 0 },
        ],
      },
    ]);
  });

  it('applies the delay to the fill notes', () => {
    expect(factsOf(drumFill, 1000).fills[0]?.notes[0]?.t).toBe(2);
  });

  it('gives no fill for a rest of 8 s or less', () => {
    const chart =
      '[Song]\n{\n  Resolution = 192\n}\n[ExpertSingle]\n{\n  0 = N 0 0\n  3072 = N 0 0\n}\n' +
      '[ExpertDoubleBass]\n{\n  1536 = N 0 0\n}\n';

    expect(factsOf(chart).fills).toEqual([]);
  });
});

describe('fills of long guitar rests in a .mid file', () => {
  it('fills from PART BASS at its highest difficulty present', () => {
    // 120 BPM: 480 ticks are 0.5 s. Guitar at 0 s and 10 s. Bass only at Hard (green 84).
    const mid = midFile([
      TEMPO_TRACK,
      track('PART GUITAR', [0, 96], [20 * RES, 97]),
      track('PART BASS', [4 * RES, 85], [4 * RES + 5, 87]),
    ]);

    expect(factsOfMid(mid).fills).toEqual([{ part: 'bass', notes: [{ t: 2, frets: [1, 3], lenSec: 0.015625 }] }]);
  });

  it('fills from PART DRUMS when bass and keys have no notes in the rest', () => {
    const mid = midFile([
      TEMPO_TRACK,
      track('PART GUITAR', [0, 96], [20 * RES, 97]),
      track('PART BASS', [30 * RES, 96]),
      track('PART KEYS'),
      track('PART DRUMS', [4 * RES, 96], [4 * RES, 97], [6 * RES, 100], [8 * RES, 95]),
    ]);

    expect(factsOfMid(mid).fills).toEqual([
      {
        part: 'drums',
        notes: [
          { t: 2, frets: [0, 7], lenSec: 0.010417 },
          { t: 3, frets: [3], lenSec: 0.010417 },
          { t: 4, frets: [7], lenSec: 0.010417 },
        ],
      },
    ]);
  });
});
