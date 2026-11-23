// The store rules of the pre-push gate (scripts/deploy/gate.ts), rules 1 to 3:
// 1. The allowlist: dist/songs/ holds only `manifest.json` and the `<name>.bin` files that the manifest names.
// 2. The manifest has exactly the schema (readManifest), the key id of the family key, and its key check.
// 3. Each store file has the size of the manifest, is 28 bytes larger than its plain content, decrypts with the
//    family key, and the keyed hash of its plain content is its name.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  decryptFile,
  ENCRYPTION_OVERHEAD,
  type FamilyKey,
  type Manifest,
  opensKeyCheck,
  readManifest,
  readSongIndex,
  storeName,
} from '../../src/model/index.ts';
import type { SongStrings } from './gate.ts';

const SONGS = 'songs';
const MANIFEST = 'manifest.json';
const utf8 = new TextDecoder();

const read = async (path: string): Promise<Uint8Array<ArrayBuffer> | undefined> =>
  readFile(path).then(
    (bytes) => new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    () => undefined
  );

/** Reads the manifest. Gives it with no failure, or the failures. */
const checkManifest = async (
  dist: string,
  key: FamilyKey
): Promise<{ manifest: Manifest | undefined; failures: string[] }> => {
  const path = `${SONGS}/${MANIFEST}`;
  const text = await readFile(join(dist, path), 'utf8').catch(() => undefined);
  if (text === undefined) {
    return { manifest: undefined, failures: [`${path}: the file is missing, so the site has no song store.`] };
  }
  const parsed = readManifest(text);
  if (!parsed.ok) {
    return { manifest: undefined, failures: [`${path}: the schema refuses the manifest: ${parsed.reason}.`] };
  }
  const manifest = parsed.value;
  if (manifest.keyId !== key.id) {
    return {
      manifest: undefined,
      failures: [`${path}: the key id ${manifest.keyId} is not the key id ${key.id} of the family key.`],
    };
  }
  if (!(await opensKeyCheck(key, manifest.keyCheck))) {
    return { manifest: undefined, failures: [`${path}: the family key does not open the key check.`] };
  }
  return { manifest, failures: [] };
};

/** Rule 1: the entries of dist/songs/ that are not the manifest or a file that it names. */
const checkAllowlist = async (dist: string, manifest: Manifest): Promise<string[]> => {
  const named = new Set([MANIFEST, ...manifest.files.map((file) => `${file.name}.bin`)]);
  const entries = await readdir(join(dist, SONGS), { withFileTypes: true });
  return entries
    .filter((entry) => !(entry.isFile() && named.has(entry.name)))
    .map((entry) => `${SONGS}/${entry.name}: the entry is not in the manifest. Only its files can be in ${SONGS}/.`);
};

/** Rule 3 for one store file. Gives the failure, or undefined. */
const checkStoreFile = async (
  dist: string,
  key: FamilyKey,
  { name, size }: Manifest['files'][number]
): Promise<string | undefined> => {
  const path = `${SONGS}/${name}.bin`;
  const bin = await read(join(dist, path));
  if (bin === undefined) {
    return `${path}: the manifest names the file, but it is missing.`;
  }
  if (bin.length !== size) {
    return `${path}: the file has ${String(bin.length)} bytes, and the manifest gives ${String(size)}.`;
  }
  const plain = await decryptFile(key, bin);
  if (plain === undefined) {
    return `${path}: the file does not decrypt with the family key.`;
  }
  if (bin.length !== plain.length + ENCRYPTION_OVERHEAD) {
    return `${path}: the file is not ${String(ENCRYPTION_OVERHEAD)} bytes larger than its content.`;
  }
  if ((await storeName(key, plain)) !== name) {
    return `${path}: the keyed hash of its content is not its name.`;
  }
  return undefined;
};

/** The songs of the song index. The index file passed rule 3. */
const indexSongs = async (dist: string, key: FamilyKey, name: string): Promise<SongStrings[] | string> => {
  const path = `${SONGS}/${name}.bin`;
  const plain = await decryptFile(key, (await read(join(dist, path))) ?? new Uint8Array());
  const index = readSongIndex(utf8.decode(plain));
  if (!index.ok) {
    return `${path}: the schema refuses the song index: ${index.reason}.`;
  }
  return index.value.songs.map(({ id, title, artist, charter }) => ({ id, title, artist, charter }));
};

/** Rules 1 to 3. Gives the failures and the songs of the song index. */
export const checkStore = async (
  dist: string,
  key: FamilyKey
): Promise<{ failures: string[]; songs: SongStrings[] }> => {
  const { manifest, failures } = await checkManifest(dist, key);
  if (manifest === undefined) {
    return { failures, songs: [] };
  }
  const allowlist = await checkAllowlist(dist, manifest);
  // One file at a time, so that only one song file is in memory.
  const results = await manifest.files.reduce<Promise<(string | undefined)[]>>(
    async (done, file) => [...(await done), await checkStoreFile(dist, key, file)],
    Promise.resolve([])
  );
  const fileFailures = results.filter((result) => result !== undefined);
  if (results[manifest.files.findIndex((file) => file.name === manifest.index)] !== undefined) {
    return { failures: [...allowlist, ...fileFailures], songs: [] };
  }
  const songs = await indexSongs(dist, key, manifest.index);
  return typeof songs === 'string'
    ? { failures: [...allowlist, ...fileFailures, songs], songs: [] }
    : { failures: [...allowlist, ...fileFailures], songs };
};
