import { describe, expect, it } from 'vitest';
import { buildSng } from './sng-fixture.ts';
import { readSng } from './sng.ts';

const text = new TextEncoder();

const MASK = Uint8Array.from({ length: 16 }, (_, at) => (at * 37 + 11) & 0xff);

describe('readSng', () => {
  it('reads the metadata pairs', () => {
    const sng = buildSng(
      [
        ['name', 'Paper Kites'],
        ['artist', 'The Lanterns'],
        ['delay', '120'],
      ],
      [],
      MASK
    );

    expect(Object.fromEntries(readSng(sng).metadata)).toEqual({
      name: 'Paper Kites',
      artist: 'The Lanterns',
      delay: '120',
    });
  });

  it('removes the color tags and the other tags from the name, the artist, and the charter', () => {
    const sng = buildSng(
      [
        ['name', '<color=#FFAA00>Paper</color> Kites'],
        ['artist', '<b>The Lanterns</b>'],
        ['charter', '<color=red>Moss</color><size=10>y</size>'],
        ['loading_phrase', 'Keep <b>this</b>'],
      ],
      [],
      MASK
    );

    const { metadata } = readSng(sng);

    expect([metadata.get('name'), metadata.get('artist'), metadata.get('charter')]).toEqual([
      'Paper Kites',
      'The Lanterns',
      'Mossy',
    ]);
    expect(metadata.get('loading_phrase')).toBe('Keep <b>this</b>');
  });

  it('unmasks the file data', () => {
    const chart = text.encode('[Song]\r\n{\r\n  Resolution = 192\r\n}\r\n'.repeat(12));
    const audio = Uint8Array.from({ length: 600 }, (_, at) => (at * 13) & 0xff);
    const sng = buildSng(
      [['name', 'Paper Kites']],
      [
        ['notes.chart', chart],
        ['guitar.opus', audio],
      ],
      MASK
    );

    const { files } = readSng(sng);

    expect(files.map((file) => file.name)).toEqual(['notes.chart', 'guitar.opus']);
    expect(files[0]?.bytes).toEqual(chart);
    expect(files[1]?.bytes).toEqual(audio);
  });

  it('refuses a file that is not an SNG container', () => {
    expect(() => readSng(text.encode('ID3 not a song package at all'))).toThrow('not an SNG file');
  });

  it('refuses an SNG version other than 1', () => {
    const sng = buildSng([], [], MASK);
    sng[6] = 2;

    expect(() => readSng(sng)).toThrow('SNG version 2');
  });

  it('refuses a cut file', () => {
    const sng = buildSng([['name', 'Paper Kites']], [['notes.chart', text.encode('[Song]')]], MASK);

    expect(() => readSng(sng.subarray(0, -3))).toThrow('cut');
  });
});
