// The store step of `prepare-song` (spec, "Delivery: the encrypted song store"). It encrypts each file of
// songs/.prepared/ and the song index into the song store, songs/.site/, and writes the plain `manifest.json`.
// - Each store file is `<name>.bin`. The name is the keyed hash of the plain content, so a file that exists with
//   that name is kept: an unchanged song keeps its names, and a second run writes no file.
// - The store refuses a family key with another key id than its manifest.
// - At the end the store holds only `manifest.json` and the files that the manifest names.
// Each file is written to a hidden temporary file first and then renamed, so a stopped run leaves no half file.

import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type CoverType,
  ENCRYPTION_OVERHEAD,
  encryptFile,
  type IndexSong,
  type Manifest,
  readManifest,
  type SongIndex,
  storeName,
} from '../../src/model/index.ts';
import type { MacKey } from './key.ts';

type Options = {
  /** The folder of the prepared songs, songs/.prepared/. */
  prepared: string;
  /** The song store, songs/.site/. */
  site: string;
  key: MacKey;
  log: (line: string) => void;
};

type Result = { ok: true } | { ok: false; reason: string };

type StoreFile = { name: string; size: number };

const MANIFEST = 'manifest.json';
const COVERS: readonly { file: string; type: CoverType }[] = [
  { file: 'cover.jpg', type: 'image/jpeg' },
  { file: 'cover.png', type: 'image/png' },
];
const utf8 = new TextEncoder();
/** The song list order: by title, then by song id. A fixed locale, so each Mac gives the same index. */
const titles = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

const readOptional = async (path: string): Promise<Uint8Array<ArrayBuffer> | undefined> =>
  readFile(path).then(
    (bytes) => new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    () => undefined
  );

/** Writes the file through a hidden temporary file, so a stopped run leaves no half-written file. */
const writeWhole = async (folder: string, name: string, bytes: Uint8Array | string) => {
  const temporary = join(folder, `.${name}.part`);
  await writeFile(temporary, bytes);
  await rename(temporary, join(folder, name));
};

/** Encrypts and keeps the plain content as a store file. A store file with that name is kept as it is. */
const storeFile = async (
  plain: Uint8Array<ArrayBuffer>,
  { site, key }: Options,
  written: string[]
): Promise<StoreFile> => {
  const name = await storeName(key.key, plain);
  const path = join(site, `${name}.bin`);
  const size = plain.length + ENCRYPTION_OVERHEAD;
  const present = await stat(path).then(
    (stats) => stats.size,
    () => undefined
  );
  if (present !== size) {
    await writeWhole(site, `${name}.bin`, await encryptFile(key.key, plain));
    written.push(name);
  }
  return { name, size };
};

type Facts = { id: string; title: string; artist: string; charter: string };

/** The song fields of the facts file. The facts file comes from the prepare step, so a wrong one is a bug. */
const readFacts = (bytes: Uint8Array, folder: string): Facts => {
  const facts: unknown = JSON.parse(new TextDecoder().decode(bytes));
  const fields = new Map<string, unknown>(typeof facts === 'object' && facts !== null ? Object.entries(facts) : []);
  const [id, title, artist, charter] = ['id', 'title', 'artist', 'charter'].map((key) => fields.get(key));
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof artist !== 'string' ||
    typeof charter !== 'string'
  ) {
    throw new Error(`${folder}/song.json is not a facts file.`);
  }
  return { id, title, artist, charter };
};

/** Stores the cover picture of a prepared song, the first that exists. A song with no cover has a plain card. */
const storeCover = async (
  path: string,
  options: Options,
  written: string[]
): Promise<{ file: StoreFile; type: CoverType } | undefined> => {
  const covers = await Promise.all(COVERS.map(async ({ file }) => readOptional(join(path, file))));
  const at = covers.findIndex((bytes) => bytes !== undefined);
  const bytes = covers[at];
  const type = COVERS[at]?.type;
  return bytes === undefined || type === undefined
    ? undefined
    : { file: await storeFile(bytes, options, written), type };
};

/** Stores the files of one prepared song. Gives its entry of the song index and its store files. */
const storeSong = async (
  folder: string,
  options: Options,
  written: string[]
): Promise<{ song: IndexSong; files: StoreFile[] }> => {
  const path = join(options.prepared, folder);
  const factsBytes = await readOptional(join(path, 'song.json'));
  const audioBytes = await readOptional(join(path, 'song.m4a'));
  if (factsBytes === undefined || audioBytes === undefined) {
    throw new Error(`${path} has no song.json or no song.m4a.`);
  }
  const { id, title, artist, charter } = readFacts(factsBytes, path);
  const facts = await storeFile(factsBytes, options, written);
  const cover = await storeCover(path, options, written);
  const audio = await storeFile(audioBytes, options, written);
  const files = [facts, ...(cover === undefined ? [] : [cover.file]), audio];
  const song: IndexSong = {
    id,
    title,
    artist,
    charter,
    files: { facts: facts.name, cover: cover?.file.name ?? null, coverType: cover?.type ?? null, audio: audio.name },
    size: files.reduce((sum, file) => sum + file.size, 0),
  };
  return { song, files };
};

/** Refuses a store whose manifest has another key id, or a manifest that cannot be read. */
const checkStoreKey = async (site: string, keyId: string): Promise<Result> => {
  const old = await readFile(join(site, MANIFEST), 'utf8').catch(() => undefined);
  if (old === undefined) {
    return { ok: true };
  }
  const manifest = readManifest(old);
  if (!manifest.ok) {
    return { ok: false, reason: `${join(site, MANIFEST)} is not a valid manifest: ${manifest.reason}.` };
  }
  if (manifest.value.keyId !== keyId) {
    return {
      ok: false,
      reason: `The store ${site} has the key id ${manifest.value.keyId}, and the family key has the key id ${keyId}. Use the family key of the store, or empty the store by hand.`,
    };
  }
  return { ok: true };
};

/** Removes every entry of the store except the manifest and the named files. Gives the count of removed entries. */
const prune = async (site: string, keep: ReadonlySet<string>): Promise<number> => {
  const extra = (await readdir(site)).filter((entry) => entry !== MANIFEST && !keep.has(entry));
  await Promise.all(extra.map(async (entry) => rm(join(site, entry), { recursive: true, force: true })));
  return extra.length;
};

/** The text of `manifest.json`, with the keys in the order of the schema. */
const manifestText = (manifest: Manifest): string => `${JSON.stringify(manifest, null, 2)}\n`;

/** Encrypts the prepared songs into the song store and writes its manifest. */
export const storeSongs = async (options: Options): Promise<Result> => {
  const { site, key, log } = options;
  const keyCheck = await checkStoreKey(site, key.key.id);
  if (!keyCheck.ok) {
    return keyCheck;
  }
  await mkdir(site, { recursive: true });
  const folders = (await readdir(options.prepared, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .toSorted();
  const written: string[] = [];
  const stored = await folders.reduce<Promise<{ song: IndexSong; files: StoreFile[] }[]>>(
    async (done, folder) => [...(await done), await storeSong(folder, options, written)],
    Promise.resolve([])
  );
  const songs = stored
    .map(({ song }) => song)
    .toSorted((one, two) => titles.compare(one.title, two.title) || (one.id < two.id ? -1 : 1));
  const songIndex: SongIndex = { version: 1, songs };
  const index = await storeFile(utf8.encode(JSON.stringify(songIndex)), options, written);
  const byName = new Map([index, ...stored.flatMap(({ files }) => files)].map((file) => [file.name, file]));
  const manifest: Manifest = {
    version: 1,
    keyId: key.key.id,
    keyCheck: key.keyCheck,
    index: index.name,
    files: [...byName.values()].toSorted((one, two) => (one.name < two.name ? -1 : 1)),
  };
  const text = manifestText(manifest);
  if ((await readFile(join(site, MANIFEST), 'utf8').catch(() => undefined)) !== text) {
    await writeWhole(site, MANIFEST, text);
    written.push(MANIFEST);
  }
  const removed = await prune(site, new Set(manifest.files.map((file) => `${file.name}.bin`)));
  log(
    `store: ${String(songs.length)} songs, ${String(manifest.files.length)} files, ${String(written.length)} written, ${String(removed)} removed.`
  );
  return { ok: true };
};

/** Empties the song store, for a new family key: every old store name belongs to the old key. */
export const emptyStore = async (site: string): Promise<void> => {
  await rm(site, { recursive: true, force: true });
};
