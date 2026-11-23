import { describe, expect, it } from 'vitest';
import { readSongChart, type SongFacts } from '../index';
import { META } from './fixtures/facts-of';
import { midFile, note, openPhrase, RES, TEMPO_TRACK, text, timeSignature, trackName } from './fixtures/mid';

const GUITAR = trackName('PART GUITAR');

const factsOfMid = (bytes: Uint8Array): SongFacts => {
  const result = readSongChart({ mid: bytes }, META);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.facts;
};

const guitarOnly = (...events: Parameters<typeof note>[]) => [GUITAR, ...events.flatMap((args) => note(...args))];

describe('readSongChart with notes.mid', () => {
  it('takes notes.mid over notes.chart', () => {
    const mid = midFile([TEMPO_TRACK, guitarOnly([RES, 96])]);
    const chart = '[Song]\n{\n  Resolution = 192\n}\n[ExpertSingle]\n{\n  0 = N 1 0\n}\n';

    const result = readSongChart({ mid, chart }, META);

    expect(result.ok && result.facts.notes).toEqual([{ t: 0.5, frets: [0], lenSec: 0.010417 }]);
  });

  it('reads notes.chart when the song has no notes.mid', () => {
    const chart = '[Song]\n{\n  Resolution = 192\n}\n[ExpertSingle]\n{\n  0 = N 1 0\n}\n';

    const result = readSongChart({ chart }, META);

    expect(result.ok && result.facts.notes).toEqual([{ t: 0, frets: [1], lenSec: 0 }]);
  });

  it('refuses a song with no chart file', () => {
    expect(readSongChart({}, META)).toEqual({ ok: false, reason: 'The song has no notes.mid and no notes.chart.' });
  });

  it('takes PART GUITAR at the highest difficulty present, and ignores other tracks', () => {
    const mid = midFile([TEMPO_TRACK, guitarOnly([0, 60], [RES, 85, 0]), [trackName('PART BASS'), ...note(0, 97)]]);

    expect(factsOfMid(mid).notes).toEqual([{ t: 0.5, frets: [1], lenSec: 0 }]);
  });

  it('refuses a .mid file with no PART GUITAR notes', () => {
    const mid = midFile([TEMPO_TRACK, [trackName('PART BASS'), ...note(0, 96)]]);

    expect(readSongChart({ mid }, META)).toEqual({ ok: false, reason: 'The chart has no lead guitar notes.' });
  });

  it('snaps notes 10 ticks apart into one chord, and keeps notes 11 ticks apart as 2 notes', () => {
    const mid = midFile([TEMPO_TRACK, guitarOnly([0, 96, 0], [10, 98, 0], [RES, 97, 0], [RES + 11, 99, 0])]);

    expect(factsOfMid(mid).notes).toEqual([
      { t: 0, frets: [0, 2], lenSec: 0.010417 },
      { t: 0.5, frets: [1], lenSec: 0 },
      { t: 0.511458, frets: [3], lenSec: 0 },
    ]);
  });

  it('keeps sustains and drops the force, tap, and star power notes', () => {
    const mid = midFile([TEMPO_TRACK, guitarOnly([0, 100, RES], [0, 101, RES], [0, 104, RES], [0, 116, RES])]);

    expect(factsOfMid(mid).notes).toEqual([{ t: 0, frets: [4], lenSec: 0.5 }]);
  });
});

describe('readSongChart open notes in notes.mid', () => {
  it('ignores the open pitch without [ENHANCED_OPENS]', () => {
    const mid = midFile([TEMPO_TRACK, guitarOnly([0, 95, 0], [RES, 96, 0])]);

    expect(factsOfMid(mid).notes).toEqual([{ t: 0.5, frets: [0], lenSec: 0 }]);
  });

  it('reads the open pitch as an open note with [ENHANCED_OPENS]', () => {
    const mid = midFile([TEMPO_TRACK, [text(0, '[ENHANCED_OPENS]'), ...guitarOnly([0, 95, 0], [RES, 96, 0])]]);

    expect(factsOfMid(mid).notes).toEqual([
      { t: 0, frets: [7], lenSec: 0 },
      { t: 0.5, frets: [0], lenSec: 0 },
    ]);
  });

  it('makes the green notes in an Expert SysEx open phrase open, and only those', () => {
    const mid = midFile([
      TEMPO_TRACK,
      [...guitarOnly([0, 96, 0], [RES, 96, 0], [RES, 97, 0], [2 * RES, 96, 0]), ...openPhrase(RES, 2 * RES, 3)],
    ]);

    expect(factsOfMid(mid).notes).toEqual([
      { t: 0, frets: [0], lenSec: 0 },
      { t: 0.5, frets: [1, 7], lenSec: 0 },
      { t: 1, frets: [0], lenSec: 0 },
    ]);
  });

  it('ignores a SysEx open phrase of another difficulty', () => {
    const mid = midFile([TEMPO_TRACK, [...guitarOnly([0, 96, 0]), ...openPhrase(0, RES, 2)]]);

    expect(factsOfMid(mid).notes).toEqual([{ t: 0, frets: [0], lenSec: 0 }]);
  });
});

describe('readSongChart beats in notes.mid', () => {
  it('takes the beats from the BEAT track first: 12 is a downbeat, 13 a beat', () => {
    const beat = [trackName('BEAT'), ...note(0, 12), ...note(RES, 13), ...note(2 * RES, 13), ...note(3 * RES, 12)];
    const mid = midFile([[...TEMPO_TRACK, timeSignature(0, 3, 4)], guitarOnly([0, 96]), beat]);

    expect(factsOfMid(mid).beats).toEqual([
      { t: 0, downbeat: true },
      { t: 0.5, downbeat: false },
      { t: 1, downbeat: false },
      { t: 1.5, downbeat: true },
    ]);
  });

  it('takes the beats from the time signatures when the file has no BEAT track', () => {
    const mid = midFile([
      [...TEMPO_TRACK.slice(0, 1), timeSignature(0, 2, 4), ...TEMPO_TRACK.slice(2)],
      guitarOnly([RES, 96, 0]),
    ]);

    expect(factsOfMid(mid).beats).toEqual([
      { t: 0, downbeat: true },
      { t: 0.5, downbeat: false },
    ]);
  });
});
