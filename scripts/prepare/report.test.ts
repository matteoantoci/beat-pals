import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSng } from '../lib/sng-fixture.ts';
import { reportSongs } from './report.ts';

const text = new TextEncoder();
const MASK = Uint8Array.from({ length: 16 }, (_, at) => (at * 31 + 3) & 0xff);
const AUDIO = Uint8Array.from({ length: 40 }, (_, at) => (at * 7) & 0xff);

/** A .chart text at 120 BPM in 4/4 with these lead guitar ticks (192 ticks to a beat of 0.5 s), each with fret `fretAt`. */
const chartOf = (ticks: readonly number[], fretAt: (at: number) => number = () => 0): string =>
  [
    '[Song]\n{\n  Resolution = 192\n}\n[SyncTrack]\n{\n  0 = TS 4\n  0 = B 120000\n}\n[ExpertSingle]\n{\n',
    ...ticks.map((tick, at) => `  ${String(tick)} = N ${String(fretAt(at))} 0\n`),
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
      '  color    step  notes  per min  longest gap       lanes',
      '  bronze      0      4     68.6  1.0 s at 0:00     Dot 100%',
      '  bronze      1      6    102.9  1.0 s at 0:01     Dot 100%',
      '  bronze      2      8    137.1  0.5 s at 0:00     Dot 100%',
    ]);
    expect(lines.filter((line) => line.startsWith('  diamond '))).toHaveLength(3);
    expect(lines.slice(-2)).toEqual([
      'quiet-hum: no child chart, The chart has no lead guitar notes.',
      'report: 2 songs, 1 with a child chart.',
    ]);
  });

  it('gives the off-beat notes in the diamond rows only', async () => {
    // Notes at 0 s and 2 s on the beat, and one at 1.25 s off the beat.
    await writeFile(join(inbox, 'paper-kites.sng'), sng('Paper Kites', chartOf([0, 480, 768])));
    const lines: string[] = [];
    await reportSongs({ inbox, log: (line) => lines.push(line) });
    const notesOf = (color: string): string[] =>
      lines.filter((line) => line.startsWith(`  ${color} `)).map((line) => line.trim().split(/ +/)[2] ?? '');
    expect(notesOf('platinum')).toEqual(['2', '2', '2']);
    expect(notesOf('diamond')).toEqual(['2', '2', '3']);
  });

  it('lists each fill of a long rest: start, end, source part, and note count', async () => {
    // Guitar at 0 s and 10 s, bass at 1 s, 2 s, and 5 s: one fill from the bass.
    const chart = `${chartOf([0, 3840])}[ExpertDoubleBass]\n{\n  384 = N 0 0\n  768 = N 1 0\n  1920 = N 2 0\n}\n`;
    await writeFile(join(inbox, 'paper-kites.sng'), sng('Paper Kites', chart));
    const lines: string[] = [];
    await reportSongs({ inbox, log: (line) => lines.push(line) });
    expect(lines.filter((line) => line.includes('fill'))).toEqual(['  fill 0:01 to 0:05  bass  3 notes']);
  });

  it('flags each silver or gold chart that gives a lane of the band less than 15% of the notes', async () => {
    // Every beat: red, red, green, green, and again. At step 2, Pip and Dot have half of the notes each, and Bo none.
    const frets = [1, 1, 0, 0, 1, 1, 0, 0];
    const chart = chartOf(
      frets.map((_, at) => at * 192),
      (at) => frets[at] ?? 0
    );
    await writeFile(join(inbox, 'paper-kites.sng'), sng('Paper Kites', chart));
    const lines: string[] = [];
    await reportSongs({ inbox, log: (line) => lines.push(line) });
    expect(lines).toContain('  silver      2      8    137.1  0.5 s at 0:00     Pip 50% Dot 50%');
    const flags = lines.filter((line) => line.includes('FLAG'));
    expect(flags).toContain('  FLAG gold step 2: Bo has 0% of the notes');
    expect(flags.filter((line) => line.includes('silver step 2'))).toEqual([]);
  });
});
