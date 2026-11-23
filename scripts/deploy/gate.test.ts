import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encryptFile, storeName } from '../../src/model/index.ts';
import { loadKey, type MacKey, makeKey } from '../prepare/key.ts';
import { storeSongs } from '../prepare/store.ts';
import { checkSite } from './gate.ts';

// All song names here are invented.
const SONG = { id: 'kites-of-paper', title: 'Paper Kites', artist: 'The Lanterns', charter: 'Mossy Fern' };
const ONE_WORD = { id: 'bright-glimmer', title: 'Glimmer', artist: 'Zephyra', charter: 'Quillon' };
const ICON = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7);

let root = '';
let dist = '';
let key: MacKey;
let otherKey: MacKey;

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const newKey = async (name: string): Promise<MacKey> => {
  await makeKey(join(root, name));
  const loaded = await loadKey(join(root, name));
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  return loaded.value;
};

/** Writes one prepared song folder, as the prepare step does. */
const prepare = async (prepared: string, song: typeof SONG) => {
  const folder = join(prepared, song.id);
  await mkdir(folder, { recursive: true });
  const facts = { version: 1, ...song, beats: [], notes: [], fills: [] };
  await writeFile(join(folder, 'song.json'), `${JSON.stringify(facts)}\n`);
  await writeFile(join(folder, 'song.m4a'), `${song.id} audio`);
};

const write = async (path: string, content: Uint8Array | string) => {
  await mkdir(join(dist, path, '..'), { recursive: true });
  await writeFile(join(dist, path), content);
};

const manifestPath = () => join(dist, 'songs', 'manifest.json');

const readManifestJson = async (): Promise<{ files: { name: string; size: number }[] }> =>
  JSON.parse(await readFile(manifestPath(), 'utf8')) as { files: { name: string; size: number }[] };

/** Adds a store file of the plain text with this name, and lists it in the manifest. */
const addStoreFile = async (name: string, bin: Uint8Array) => {
  await write(`songs/${name}.bin`, bin);
  const manifest = await readManifestJson();
  manifest.files = [...manifest.files, { name, size: bin.length }].toSorted((one, two) =>
    one.name < two.name ? -1 : 1
  );
  await writeFile(manifestPath(), JSON.stringify(manifest));
};

const check = async () => checkSite({ dist, key: key.key, appAssets: new Set([sha256(ICON)]) });

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'beat-pals-gate-'));
  dist = join(root, 'dist');
  key = await newKey('key');
  otherKey = await newKey('other-key');
  const prepared = join(root, 'prepared');
  const site = join(root, 'site');
  await prepare(prepared, SONG);
  await prepare(prepared, ONE_WORD);
  const stored = await storeSongs({ prepared, site, key, log: () => undefined });
  if (!stored.ok) {
    throw new Error(stored.reason);
  }
  await cp(site, join(dist, 'songs'), { recursive: true });
  await write('index.html', '<script type="module" src="/beat-pals/assets/index-abc.js"></script>');
  await write('assets/index-abc.js', 'const glow = "golden"; console.log(glow);');
  await write('.nojekyll', '');
  await write('pwa-192x192.png', Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1));
  await write('assets/icon-abc.png', ICON);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('checkSite', () => {
  it('passes a site with the song store, the app code, and the app assets', async () => {
    expect(await check()).toEqual([]);
  });

  it('refuses a site with no song store', async () => {
    await rm(join(dist, 'songs'), { recursive: true });

    expect(await check()).toEqual([expect.stringContaining('songs/manifest.json')]);
  });

  describe('the allowlist under dist/songs/', () => {
    it('refuses an extra file', async () => {
      await write('songs/notes.txt', 'hello');

      expect(await check()).toEqual([expect.stringMatching(/songs\/notes\.txt: .*not in the manifest/u)]);
    });

    it('refuses a folder', async () => {
      await write('songs/extra/a.txt', 'hello');

      expect(await check()).toEqual([expect.stringMatching(/songs\/extra: .*not in the manifest/u)]);
    });

    it('refuses a store file that the manifest does not name', async () => {
      const plain = new TextEncoder().encode('loose file');
      const name = await storeName(key.key, plain);
      await write(`songs/${name}.bin`, await encryptFile(key.key, plain));

      expect(await check()).toEqual([
        expect.stringMatching(new RegExp(`songs/${name}\\.bin: .*not in the manifest`, 'u')),
      ]);
    });

    it('refuses a file that the manifest names but that is missing', async () => {
      const manifest = await readManifestJson();
      const [first] = manifest.files;
      await rm(join(dist, 'songs', `${first?.name ?? ''}.bin`));

      expect(await check()).toEqual([expect.stringMatching(/missing/u)]);
    });
  });

  describe('the manifest', () => {
    it('refuses a manifest with an extra field', async () => {
      const manifest = await readManifestJson();
      await writeFile(manifestPath(), JSON.stringify({ ...manifest, comment: 'extra' }));

      expect(await check()).toEqual([expect.stringMatching(/songs\/manifest\.json: .*keys/u)]);
    });

    it('refuses a manifest of another family key', async () => {
      const failures = await checkSite({ dist, key: otherKey.key, appAssets: new Set() });

      expect(failures[0]).toMatch(/key id/u);
    });
  });

  describe('the store files', () => {
    it('refuses a file that does not decrypt', async () => {
      const { files } = await readManifestJson();
      const path = join(dist, 'songs', `${files[0]?.name ?? ''}.bin`);
      const bytes = await readFile(path);
      bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) ^ 1;
      await writeFile(path, bytes);

      expect(await check()).toEqual([expect.stringMatching(/does not decrypt/u)]);
    });

    it('refuses a file of another family key', async () => {
      const plain = new TextEncoder().encode('other key file');
      await addStoreFile(await storeName(key.key, plain), await encryptFile(otherKey.key, plain));

      expect(await check()).toEqual([expect.stringMatching(/does not decrypt/u)]);
    });

    it('refuses a file whose keyed hash is not its name', async () => {
      const plain = new TextEncoder().encode('renamed file');
      await addStoreFile('0'.repeat(64), await encryptFile(key.key, plain));

      expect(await check()).toEqual([expect.stringMatching(/keyed hash/u)]);
    });

    it('refuses a file whose size is not the size in the manifest', async () => {
      const manifest = await readManifestJson();
      manifest.files = manifest.files.map((file, at) => (at === 0 ? { ...file, size: file.size + 1 } : file));
      await writeFile(manifestPath(), JSON.stringify(manifest));

      expect(await check()).toEqual([expect.stringMatching(/bytes/u)]);
    });
  });

  describe('raw media', () => {
    const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    it.each([
      ['ftyp (MP4 or M4A)', Uint8Array.of(0, 0, 0, 0x20, ...new TextEncoder().encode('ftypM4A '))],
      ['OggS (Ogg or Opus)', new TextEncoder().encode('OggS\0\u0002 page')],
      ['SNGPKG (a .sng file)', new TextEncoder().encode('SNGPKG\u0001\0\0\0')],
      ['JPEG', Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0x10)],
      ['PNG', Uint8Array.of(...PNG, 1, 2)],
    ])('refuses %s magic in a file that is not an app asset', async (_kind, bytes) => {
      await write('assets/data-abc.js', bytes);

      expect(await check()).toEqual([expect.stringMatching(/assets\/data-abc\.js: .*magic/u)]);
    });

    it.each(['song.sng', 'music/song.m4a', 'song.opus'])('refuses the raw media file %s', async (path) => {
      await write(path, 'not really audio');

      expect(await check()).toEqual([expect.stringContaining(`${path}: `)]);
    });
  });
});
