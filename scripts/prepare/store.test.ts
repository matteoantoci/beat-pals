import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptFile, type FamilyKey, readManifest, readSongIndex } from '../../src/model/index.ts';
import { loadKey, type MacKey, makeKey } from './key.ts';
import { emptyStore, storeSongs } from './store.ts';

const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3);

let root = '';
let prepared = '';
let site = '';
let lines: string[] = [];
/** The song ids of the inbox: each prepared song has its .sng file unless a test removes it. */
let songIds = new Set<string>();

/** Makes a family key in a key folder of its own, under the temporary folder. */
const newKey = async (name: string): Promise<MacKey> => {
  await makeKey(join(root, name));
  const loaded = await loadKey(join(root, name));
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  return loaded.value;
};

type Song = { id: string; title: string; audio: string; cover?: Uint8Array };

/** Writes a prepared song folder as the prepare step does: the facts file, the audio, and the cover. */
const prepare = async ({ id, title, audio, cover }: Song) => {
  const folder = join(prepared, id);
  songIds.add(id);
  await mkdir(folder, { recursive: true });
  const facts = { version: 1, id, title, artist: 'The Lanterns', charter: 'Mossy', beats: [], notes: [], fills: [] };
  await writeFile(join(folder, 'song.json'), `${JSON.stringify(facts)}\n`);
  await writeFile(join(folder, 'song.m4a'), audio);
  await writeFile(join(folder, 'stamp.json'), '{}\n');
  if (cover !== undefined) {
    await writeFile(join(folder, 'cover.png'), cover);
  }
};

const store = async (key: MacKey) => storeSongs({ prepared, site, key, songIds, log: (line) => lines.push(line) });

const manifestOf = async () => {
  const manifest = readManifest(await readFile(join(site, 'manifest.json'), 'utf8'));
  if (!manifest.ok) {
    throw new Error(manifest.reason);
  }
  return manifest.value;
};

const open = async (key: FamilyKey, name: string) => decryptFile(key, await readFile(join(site, `${name}.bin`)));

const indexOf = async (key: FamilyKey) => {
  const plain = await open(key, (await manifestOf()).index);
  const index = readSongIndex(new TextDecoder().decode(plain));
  if (!index.ok) {
    throw new Error(index.reason);
  }
  return index.value;
};

/** Each entry of the store with its modification time. */
const snapshot = async () =>
  Promise.all(
    (await readdir(site)).toSorted().map(async (entry) => [entry, (await stat(join(site, entry))).mtimeMs] as const)
  );

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'beat-pals-store-'));
  prepared = join(root, 'songs', '.prepared');
  site = join(root, 'songs', '.site');
  lines = [];
  songIds = new Set();
  await mkdir(prepared, { recursive: true });
  await prepare({ id: 'paper-kites', title: 'Paper Kites', audio: 'kites audio', cover: PNG });
  await prepare({ id: 'quiet-moon', title: 'A Quiet Moon', audio: 'moon audio' });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('storeSongs', () => {
  it('encrypts each prepared file, and the family key decrypts it to the plain file', async () => {
    const key = await newKey('key');

    expect(await store(key)).toEqual({ ok: true });

    const [moon, kites] = (await indexOf(key.key)).songs;
    expect(new TextDecoder().decode(await open(key.key, kites?.files.audio ?? ''))).toBe('kites audio');
    expect(await open(key.key, kites?.files.cover ?? '')).toEqual(PNG);
    const facts: unknown = JSON.parse(new TextDecoder().decode(await open(key.key, moon?.files.facts ?? '')));
    expect(facts).toMatchObject({ id: 'quiet-moon', title: 'A Quiet Moon' });
  });

  it('writes the song index in title order, with the encrypted sizes and the cover type', async () => {
    const key = await newKey('key');
    await store(key);
    const sizes = new Map((await manifestOf()).files.map((file) => [file.name, file.size]));
    const sizeOf = (name: string | null) => sizes.get(name ?? '') ?? 0;

    const index = await indexOf(key.key);

    expect(index.songs.map((song) => [song.id, song.title, song.artist, song.charter])).toEqual([
      ['quiet-moon', 'A Quiet Moon', 'The Lanterns', 'Mossy'],
      ['paper-kites', 'Paper Kites', 'The Lanterns', 'Mossy'],
    ]);
    expect(index.songs.map((song) => [song.files.cover === null, song.files.coverType])).toEqual([
      [true, null],
      [false, 'image/png'],
    ]);
    expect(sizeOf(index.songs[1]?.files.audio ?? null)).toBe('kites audio'.length + 28);
    expect(index.songs.map((song) => song.size)).toEqual(
      index.songs.map(({ files }) => sizeOf(files.facts) + sizeOf(files.cover) + sizeOf(files.audio))
    );
  });

  it('writes a manifest with the key id and the key check, and files sorted by name', async () => {
    const key = await newKey('key');
    await store(key);

    const manifest = await manifestOf();

    expect(manifest.keyId).toBe(key.key.id);
    expect(manifest.keyCheck).toBe(key.keyCheck);
    // 2 facts files, 2 audio files, 1 cover, and the index.
    expect(manifest.files).toHaveLength(6);
    expect(manifest.files.map((file) => file.name)).toEqual(manifest.files.map((file) => file.name).toSorted());
  });

  it('leaves only the manifest and the files that it names in the store', async () => {
    const key = await newKey('key');
    await mkdir(site, { recursive: true });
    await writeFile(join(site, `${'f'.repeat(64)}.bin`), 'old');
    await writeFile(join(site, '.DS_Store'), 'finder');
    await store(key);
    await rm(join(prepared, 'paper-kites'), { recursive: true });

    await store(key);

    const manifest = await manifestOf();
    expect((await readdir(site)).toSorted()).toEqual(
      ['manifest.json', ...manifest.files.map((file) => `${file.name}.bin`)].toSorted()
    );
    expect(manifest.files).toHaveLength(3);
  });

  it('writes no file at a second run, and every name stays the same', async () => {
    const key = await newKey('key');
    await store(key);
    const first = await snapshot();
    const manifest = await readFile(join(site, 'manifest.json'), 'utf8');

    await store(key);

    expect(await snapshot()).toEqual(first);
    expect(await readFile(join(site, 'manifest.json'), 'utf8')).toBe(manifest);
    expect(lines.at(-1)).toMatch(/ 0 written, 0 removed\.$/u);
  });

  it('renames every store file after a key change, and the old key opens none of the new files', async () => {
    const old = await newKey('old');
    await store(old);
    const oldNames = new Set((await manifestOf()).files.map((file) => file.name));
    const key = await newKey('new');

    await emptyStore(site);
    await store(key);

    const files = (await manifestOf()).files;
    expect(files.filter((file) => oldNames.has(file.name))).toEqual([]);
    const opened = await Promise.all(files.map(async (file) => open(old.key, file.name)));
    expect(opened.filter((plain) => plain !== undefined)).toEqual([]);
  });

  it('refuses to write into a store with another key id', async () => {
    await store(await newKey('old'));
    const before = await snapshot();

    const result = await store(await newKey('new'));

    expect(result.ok ? 'ok' : result.reason).toMatch(/key id/u);
    expect(await snapshot()).toEqual(before);
  });

  it('keeps an unchanged song and writes only the files of a changed song', async () => {
    const key = await newKey('key');
    await store(key);
    const before = new Set((await manifestOf()).files.map((file) => file.name));
    await prepare({ id: 'quiet-moon', title: 'A Quiet Moon', audio: 'new moon audio' });

    await store(key);

    const added = (await manifestOf()).files.filter((file) => !before.has(file.name));
    // The new audio and the new index.
    expect(added).toHaveLength(2);
    expect(lines.at(-1)).toMatch(/ 3 written, 2 removed\.$/u);
  });

  it('stores no prepared song whose .sng file left the inbox, and logs it', async () => {
    const key = await newKey('key');
    songIds.delete('paper-kites');

    await store(key);

    expect((await indexOf(key.key)).songs.map((song) => song.id)).toEqual(['quiet-moon']);
    expect(lines).toContain('paper-kites: not stored, no .sng file in the inbox has this id.');
  });
});
