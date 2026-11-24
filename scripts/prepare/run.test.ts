import { copyFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSng } from '../lib/sng-fixture.ts';
import { type Encoder, prepareSongs } from './run.ts';

const text = new TextEncoder();
const MASK = Uint8Array.from({ length: 16 }, (_, at) => (at * 53 + 7) & 0xff);
const CHART = '[Song]\n{\n  Resolution = 192\n}\n[ExpertSingle]\n{\n  0 = N 1 0\n  192 = N 2 0\n}\n';
const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3);
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 4, 5, 6);
const audio = (seed: number) => Uint8Array.from({ length: 40 }, (_, at) => (at * seed) & 0xff);

type Entry = readonly [string, Uint8Array];

const METADATA = [
  ['name', '<color=#FFAA00>Paper</color> Kites'],
  ['artist', '<b>The Lanterns</b>'],
  ['charter', 'Mossy'],
  ['delay', '250'],
] as const;

const song = (files: readonly Entry[], metadata: readonly (readonly [string, string])[] = METADATA) =>
  buildSng(metadata, [['notes.chart', text.encode(CHART)], ...files], MASK);

let inbox = '';
let prepared = '';
let lines: string[] = [];
let mixes: string[][] = [];

/** A fake encoder: it records the audio parts of each mix and writes small files instead of ffmpeg output. */
const encoder: Encoder = {
  audio: async (parts, out) => {
    mixes.push(parts.map((part) => basename(part)));
    await writeFile(out, 'mix');
    return ['loudness: measured'];
  },
  picture: async (input, out) => copyFile(input, out),
};

const prepare = async (only?: string) =>
  prepareSongs({ inbox, prepared, encoder, log: (line) => lines.push(line), only });

const put = async (name: string, bytes: Uint8Array) => writeFile(join(inbox, name), bytes);

beforeEach(async () => {
  inbox = await mkdtemp(join(tmpdir(), 'prepare-song-'));
  prepared = join(inbox, '.prepared');
  lines = [];
  mixes = [];
});

afterEach(async () => {
  await rm(inbox, { recursive: true, force: true });
});

describe('prepareSongs', () => {
  it('writes the facts file with the tags removed and the delay applied', async () => {
    await put('paper-kites.sng', song([['song.opus', audio(3)]]));

    expect(await prepare()).toBe(0);

    const facts: unknown = JSON.parse(await readFile(join(prepared, 'paper-kites', 'song.json'), 'utf8'));
    expect(facts).toMatchObject({
      id: 'paper-kites',
      title: 'Paper Kites',
      artist: 'The Lanterns',
      charter: 'Mossy',
      notes: [
        { t: 0.25, frets: [1], lenSec: 0 },
        { t: 0.75, frets: [2], lenSec: 0 },
      ],
    });
    expect((await readdir(join(prepared, 'paper-kites'))).toSorted()).toEqual(['song.json', 'song.m4a', 'stamp.json']);
  });

  it('mixes all audio parts except preview and crowd, and drums or vocals when a split part exists', async () => {
    await put(
      'paper-kites.sng',
      song([
        ['song.opus', audio(3)],
        ['drums.opus', audio(5)],
        ['vocals.opus', audio(7)],
        ['vocals_1.opus', audio(9)],
        ['crowd.ogg', audio(11)],
        ['preview.ogg', audio(13)],
      ])
    );
    await put(
      'moss-garden.sng',
      song([
        ['guitar.ogg', audio(3)],
        ['drums.ogg', audio(5)],
        ['drums_1.ogg', audio(7)],
        ['vocals.ogg', audio(9)],
      ])
    );

    await prepare();

    expect(mixes).toEqual([
      ['guitar.ogg', 'drums_1.ogg', 'vocals.ogg'],
      ['song.opus', 'drums.opus', 'vocals_1.opus'],
    ]);
    expect(lines).toEqual(
      expect.arrayContaining([
        '  skipped part: drums.ogg (drums_1 exists)',
        '  skipped part: vocals.opus (vocals_1 exists)',
        '  skipped part: crowd.ogg (crowd noise is not part of the song)',
        '  skipped part: preview.ogg (the preview clip is not part of the song)',
      ])
    );
  });

  it('takes the picture override first, then the album picture, then a plain card, and logs the source', async () => {
    await put(
      'paper-kites.sng',
      song([
        ['song.opus', audio(3)],
        ['album.png', PNG],
      ])
    );
    await put('paper-kites.jpg', JPEG);
    await put(
      'moss-garden.sng',
      song([
        ['song.opus', audio(3)],
        ['album.png', PNG],
      ])
    );
    await put('fern-hill.sng', song([['song.opus', audio(3)]]));

    await prepare();

    expect(await readFile(join(prepared, 'paper-kites', 'cover.jpg'))).toEqual(Buffer.from(JPEG));
    expect(await readFile(join(prepared, 'moss-garden', 'cover.png'))).toEqual(Buffer.from(PNG));
    expect(await readdir(join(prepared, 'fern-hill'))).not.toContain(expect.stringMatching(/^cover/u));
    expect(lines).toEqual(
      expect.arrayContaining([
        '  picture: paper-kites.jpg (the override), a JPEG picture',
        '  picture: album.png from the .sng, a PNG picture',
        '  picture: none, the game shows a plain card',
      ])
    );
  });

  it('keeps the real image type of an album picture with the wrong file name', async () => {
    await put(
      'paper-kites.sng',
      song([
        ['song.opus', audio(3)],
        ['album.png', JPEG],
      ])
    );

    await prepare();

    expect(await readdir(join(prepared, 'paper-kites'))).toContain('cover.jpg');
  });

  it('skips an unchanged song before the encoder runs', async () => {
    await put('paper-kites.sng', song([['song.opus', audio(3)]]));
    await prepare();
    mixes = [];
    lines = [];

    await prepare();

    expect(mixes).toEqual([]);
    expect(lines).toContain('paper-kites: unchanged, skipped before ffmpeg.');
  });

  it('writes only the facts file again when only the facts version of the stamp changed', async () => {
    await put('paper-kites.sng', song([['song.opus', audio(3)]]));
    await prepare();
    const folder = join(prepared, 'paper-kites');
    const stamp = await readFile(join(folder, 'stamp.json'), 'utf8');
    // A stamp of the facts version 1, which had no `facts` field.
    await writeFile(join(folder, 'stamp.json'), stamp.replace(/\s*"facts": \d+,/u, ''));
    await writeFile(join(folder, 'song.json'), '{}\n');
    mixes = [];
    lines = [];

    await prepare();

    expect(mixes).toEqual([]);
    expect(lines).toEqual([
      'paper-kites: facts refreshed, the audio and the cover stay.',
      'prepare-song: 0 prepared, 1 refreshed, 0 unchanged, 0 skipped, 0 failed.',
    ]);
    expect(JSON.parse(await readFile(join(folder, 'song.json'), 'utf8'))).toMatchObject({ id: 'paper-kites' });
    expect(await readFile(join(folder, 'song.m4a'), 'utf8')).toBe('mix');
  });

  it('prepares a song again when its picture override changes', async () => {
    await put('paper-kites.sng', song([['song.opus', audio(3)]]));
    await prepare();
    await put('paper-kites.png', PNG);

    await prepare();

    expect(mixes).toHaveLength(2);
    expect(await readdir(join(prepared, 'paper-kites'))).toContain('cover.png');
  });

  it('skips and logs a bad song id, other files, and a file that is not an SNG container', async () => {
    await put('Paper Kites.sng', song([['song.opus', audio(3)]]));
    await put('notes.txt', text.encode('a note'));
    await put('moss-garden.png', PNG);
    await put('fern-hill.sng', text.encode('not a song package'));
    await put('.DS_Store', text.encode('finder'));

    expect(await prepare()).toBe(0);

    expect(lines).toEqual([
      'Paper Kites.sng: skipped, the song id does not match ^[a-z0-9-]+$.',
      'moss-garden.png: skipped, no .sng file has this name.',
      'notes.txt: skipped, it is not a .sng file or a picture override.',
      'fern-hill: skipped, This is not an SNG file: it does not start with SNGPKG.',
      'prepare-song: 0 prepared, 0 refreshed, 0 unchanged, 1 skipped, 0 failed.',
    ]);
    expect(await readdir(prepared)).toEqual([]);
  });

  it('skips a song with no lead guitar or no audio', async () => {
    const noGuitar = '[Song]\n{\n  Resolution = 192\n}\n[ExpertDoubleBass]\n{\n  0 = N 1 0\n}\n';
    await put('paper-kites.sng', buildSng(METADATA, [['notes.chart', text.encode(noGuitar)]], MASK));
    await put('moss-garden.sng', song([['album.png', PNG]]));

    await prepare();

    expect(lines).toEqual([
      'moss-garden: skipped, The .sng file has no audio part to mix.',
      'paper-kites: skipped, The chart has no lead guitar notes.',
      'prepare-song: 0 prepared, 0 refreshed, 0 unchanged, 2 skipped, 0 failed.',
    ]);
  });

  it('prepares only the song that --only names', async () => {
    await put('paper-kites.sng', song([['song.opus', audio(3)]]));
    await put('moss-garden.sng', song([['song.opus', audio(5)]]));

    await prepare('moss-garden');

    expect(await readdir(prepared)).toEqual(['moss-garden']);
    expect(await prepare('fern-hill')).toBe(1);
  });

  it('logs and counts a song that the encoder cannot encode, and goes on with the other songs (story 50)', async () => {
    await put('paper-kites.sng', song([['song.opus', audio(3)]]));
    await put('moss-garden.sng', song([['song.opus', audio(5)]]));
    const broken: Encoder = {
      ...encoder,
      audio: async (parts, out) =>
        out.includes('paper-kites') ? Promise.reject(new Error('ffmpeg failed: no codec')) : encoder.audio(parts, out),
    };

    const code = await prepareSongs({ inbox, prepared, encoder: broken, log: (line) => lines.push(line) });

    expect(code).toBe(0);
    expect(lines).toContain('paper-kites: failed, ffmpeg failed: no codec');
    expect(lines.at(-1)).toBe('prepare-song: 1 prepared, 0 refreshed, 0 unchanged, 0 skipped, 1 failed.');
    expect(await readdir(prepared)).toEqual(['moss-garden']);
  });

  it('removes and logs each prepared folder whose .sng file left the inbox', async () => {
    await put('paper-kites.sng', song([['song.opus', audio(3)]]));
    await put('moss-garden.sng', song([['song.opus', audio(5)]]));
    await prepare();
    await rm(join(inbox, 'paper-kites.sng'));
    lines = [];

    await prepare();

    expect(await readdir(prepared)).toEqual(['moss-garden']);
    expect(lines).toContain('paper-kites: removed from the prepared songs, its .sng file is gone.');
  });
});
