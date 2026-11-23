import { describe, expect, it } from 'vitest';
import { downloadPlan } from '../index';
import type { IndexSong, Manifest, SongIndex } from '../index';

/** A store name: 64 hex characters that start with the letter. */
const name = (letter: string): string => letter.repeat(64);

const INDEX = name('0');
const KITES_FACTS = name('1');
const KITES_COVER = name('2');
const KITES_AUDIO = name('3');
const MOON_FACTS = name('4');
const MOON_AUDIO = name('5');
const OLD = name('9');

const SIZES: Readonly<Record<string, number>> = {
  [INDEX]: 400,
  [KITES_FACTS]: 1000,
  [KITES_COVER]: 2000,
  [KITES_AUDIO]: 7000,
  [MOON_FACTS]: 500,
  [MOON_AUDIO]: 4500,
};

const KITES: IndexSong = {
  id: 'paper-kites',
  title: 'Paper Kites',
  artist: 'The Lanterns',
  charter: 'Mossy',
  files: { facts: KITES_FACTS, cover: KITES_COVER, coverType: 'image/png', audio: KITES_AUDIO },
  size: 10_000,
};

const MOON: IndexSong = {
  id: 'quiet-moon',
  title: 'Quiet Moon',
  artist: 'The Lanterns',
  charter: 'Mossy',
  files: { facts: MOON_FACTS, cover: null, coverType: null, audio: MOON_AUDIO },
  size: 5000,
};

const MANIFEST: Manifest = {
  version: 1,
  keyId: '1707b293ed51dab8',
  keyCheck: 'AbC-_9',
  index: INDEX,
  files: Object.entries(SIZES).map(([file, size]) => ({ name: file, size })),
};

const SONG_INDEX: SongIndex = { version: 1, songs: [KITES, MOON] };

describe('downloadPlan', () => {
  it('fetches every song file, song by song in the index order, when the cache is empty', () => {
    const plan = downloadPlan(MANIFEST, SONG_INDEX, new Set([INDEX]));

    expect(plan.fetch).toEqual([
      { name: KITES_FACTS, size: 1000 },
      { name: KITES_COVER, size: 2000 },
      { name: KITES_AUDIO, size: 7000 },
      { name: MOON_FACTS, size: 500 },
      { name: MOON_AUDIO, size: 4500 },
    ]);
    expect(plan.ready).toEqual([]);
    expect(plan.total).toEqual({ songs: 2, bytes: 15_000 });
    expect(plan.done).toEqual({ songs: 0, bytes: 0 });
  });

  it('skips a cached file and continues from the next missing file', () => {
    const plan = downloadPlan(MANIFEST, SONG_INDEX, new Set([INDEX, KITES_FACTS, KITES_COVER]));

    expect(plan.fetch.map((file) => file.name)).toEqual([KITES_AUDIO, MOON_FACTS, MOON_AUDIO]);
    expect(plan.done).toEqual({ songs: 0, bytes: 3000 });
  });

  it('gives a song as ready only when all its files are in the cache', () => {
    const plan = downloadPlan(MANIFEST, SONG_INDEX, new Set([INDEX, MOON_FACTS, MOON_AUDIO, KITES_AUDIO]));

    expect(plan.ready).toEqual([MOON]);
    expect(plan.fetch.map((file) => file.name)).toEqual([KITES_FACTS, KITES_COVER]);
    expect(plan.done).toEqual({ songs: 1, bytes: 12_000 });
  });

  it('fetches nothing when all files are cached', () => {
    const plan = downloadPlan(MANIFEST, SONG_INDEX, new Set(Object.keys(SIZES)));

    expect(plan.fetch).toEqual([]);
    expect(plan.ready).toEqual([KITES, MOON]);
    expect(plan.done).toEqual(plan.total);
  });

  it('deletes the cached files that the manifest does not name', () => {
    const plan = downloadPlan(MANIFEST, SONG_INDEX, new Set([OLD, INDEX, KITES_FACTS]));

    expect(plan.remove).toEqual([OLD]);
  });

  it('fetches a file that 2 songs share only one time', () => {
    const twin: IndexSong = { ...MOON, id: 'quiet-moon-live', files: { ...MOON.files, facts: KITES_FACTS } };

    const plan = downloadPlan(MANIFEST, { version: 1, songs: [KITES, twin] }, new Set([INDEX]));

    expect(plan.fetch.map((file) => file.name)).toEqual([KITES_FACTS, KITES_COVER, KITES_AUDIO, MOON_AUDIO]);
  });

  it('leaves out a song with a file that the manifest does not name, because it can never be ready', () => {
    const broken: IndexSong = { ...MOON, files: { ...MOON.files, audio: OLD } };

    const plan = downloadPlan(MANIFEST, { version: 1, songs: [KITES, broken] }, new Set([INDEX]));

    expect(plan.total).toEqual({ songs: 1, bytes: 10_000 });
    expect(plan.fetch.map((file) => file.name)).toEqual([KITES_FACTS, KITES_COVER, KITES_AUDIO]);
  });
});
