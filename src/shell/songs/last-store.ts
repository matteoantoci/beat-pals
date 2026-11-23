// The last complete store on the device (spec, "Delivery", last manifest). After a complete download, the game keeps
// that manifest and its encrypted song index in Cache Storage under fixed keys. An offline cold start reads them.
// Only then does the game delete the cached files that the kept manifest does not name, so an interrupted download
// never deletes a file that the songs of the last manifest need.

import { decryptFile, readManifest, readSongIndex, storeName } from '../../model';
import { CACHE, fileUrl, readCachedFile, SONGS } from './store';
import type { FamilyKey, Manifest, SongIndex } from '../../model';

const LAST_MANIFEST = `${SONGS}last/manifest.json`;
const LAST_INDEX = `${SONGS}last/index.bin`;

/** The kept manifest and its song index. */
export type LastStore = { manifest: Manifest; index: SongIndex };

/**
 * Keeps the manifest of a complete download and its song index under the fixed keys, and then deletes the cached
 * files in `remove`: the files that this manifest does not name.
 */
export const keepLastStore = async (manifest: Manifest, remove: readonly string[]): Promise<void> => {
  const cache = await caches.open(CACHE);
  const index = await cache.match(fileUrl(manifest.index));
  if (index === undefined) {
    throw new Error('The song index of a complete download is not in the cache.');
  }
  await cache.put(LAST_INDEX, index);
  await cache.put(
    LAST_MANIFEST,
    new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } })
  );
  await Promise.all(remove.map(async (name) => cache.delete(fileUrl(name))));
};

/**
 * The plain song index of the kept manifest. The copy under the fixed key must have the index name of the manifest
 * as its keyed hash: a stop between the 2 writes of `keepLastStore` can leave a newer index there. Then the index
 * file of the manifest, which stays in the cache, is used.
 */
const lastIndexBytes = async (key: FamilyKey, manifest: Manifest): Promise<Uint8Array<ArrayBuffer> | undefined> => {
  const cache = await caches.open(CACHE);
  const kept = await cache.match(LAST_INDEX);
  const plain = kept === undefined ? undefined : await decryptFile(key, new Uint8Array(await kept.arrayBuffer()));
  if (plain !== undefined && (await storeName(key, plain)) === manifest.index) {
    return plain;
  }
  return readCachedFile(key, manifest.index);
};

/** The kept manifest and its song index, or undefined when no download was complete or they do not open. */
export const readLastStore = async (key: FamilyKey): Promise<LastStore | undefined> => {
  const cache = await caches.open(CACHE);
  const response = await cache.match(LAST_MANIFEST);
  const manifest = response === undefined ? undefined : readManifest(await response.text());
  if (manifest?.ok !== true || manifest.value.keyId !== key.id) {
    return undefined;
  }
  const plain = await lastIndexBytes(key, manifest.value);
  const index = plain === undefined ? undefined : readSongIndex(new TextDecoder().decode(plain));
  return index?.ok === true ? { manifest: manifest.value, index: index.value } : undefined;
};

/** Deletes every song file, the kept manifest and its index included. */
export const forgetSongFiles = async (): Promise<void> => {
  await caches.delete(CACHE);
};
