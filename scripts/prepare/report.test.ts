import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSng } from '../lib/sng-fixture.ts';
import { reportSongs } from './report.ts';

const text = new TextEncoder();
const MASK = Uint8Array.from({ length: 16 }, (_, at) => (at * 31 + 3) & 0xff);
const AUDIO = Uint8Array.from({ length: 40 }, (_, at) => (at * 7) & 0xff);

/** A .chart text at 120 BPM in 4/4 with these lead guitar ticks (192 ticks to a beat of 0.5 s). */
const chartOf = (ticks: readonly number[]): string =>
  [
    '[Song]\n{\n  Resolution = 192\n}\n[SyncTrack]\n{\n  0 = TS 4\n  0 = B 120000\n}\n[ExpertSingle]\n{\n',
    ...ticks.map((tick) => `  ${String(tick)} = N 0 0\n`),
    '}\n',
  ].join('');

const NO_GUITAR = '[Song]\n{\n  Resolution = 192\n}\n[ExpertDoubleBass]\n{\n  0 = N 0 0\n}\n';

const sng = (name: string, chart: string) =>
  buildSng(
    [
      ['name', name],
      ['artist', 'The Lanterns'],
    ],
    [
      ['notes.chart', text.encode(chart)],
      ['song.ogg', AUDIO],
    ],
    MASK
  );

let inbox = '';

beforeEach(async () => {
  inbox = await mkdtemp(join(tmpdir(), 'report-'));
});

afterEach(async () => {
  await rm(inbox, { recursive: true, force: true });
});

describe('reportSongs', () => {
  it('gives the child note count, the notes per minute, and the longest gap for each record color and step', async () => {
    // 2 bars with a note on each beat: from 0 s to 3.5 s.
    await writeFile(
      join(inbox, 'paper-kites.sng'),
      sng('Paper Kites', chartOf([0, 192, 384, 576, 768, 960, 1152, 1344]))
    );
    await writeFile(join(inbox, 'quiet-hum.sng'), sng('Quiet Hum', NO_GUITAR));
    const lines: string[] = [];
    await reportSongs({ inbox, log: (line) => lines.push(line) });
    expect(lines.slice(0, 5)).toEqual([
      'paper-kites: Paper Kites / The Lanterns | notes to 0:03 | beat 0.50 s (120 BPM)',
      '  color    step  notes  per min  longest gap',
      '  bronze      0      4     68.6  1.0 s at 0:00',
      '  bronze      1      6    102.9  1.0 s at 0:01',
      '  bronze      2      8    137.1  0.5 s at 0:00',
    ]);
    expect(lines.filter((line) => line.startsWith('  diamond '))).toHaveLength(3);
    expect(lines.slice(-2)).toEqual([
      'quiet-hum: no child chart, The chart has no lead guitar notes.',
      'report: 2 songs, 1 with a child chart.',
    ]);
  });

  it('lists each fill of a long rest: start, end, source part, and note count', async () => {
    // Guitar at 0 s and 10 s, bass at 1 s, 2 s, and 5 s: one fill from the bass.
    const chart = `${chartOf([0, 3840])}[ExpertDoubleBass]\n{\n  384 = N 0 0\n  768 = N 1 0\n  1920 = N 2 0\n}\n`;
    await writeFile(join(inbox, 'paper-kites.sng'), sng('Paper Kites', chart));
    const lines: string[] = [];
    await reportSongs({ inbox, log: (line) => lines.push(line) });
    expect(lines.filter((line) => line.includes('fill'))).toEqual(['  fill 0:01 to 0:05  bass  3 notes']);
  });
});
