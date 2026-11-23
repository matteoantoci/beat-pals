// The song store on the site and in Cache Storage (spec, "Delivery"). The site serves `songs/manifest.json` and the
// encrypted `songs/<name>.bin` files. The game keeps the encrypted files in the cache `beat-pals-songs`, under
// their site URL, and decrypts them only in memory.

import { decryptFile, readManifest, readSongIndex, storeName } from '../../model';
import type { FamilyKey, Manifest, SongIndex } from '../../model';

/** A read of the store. `network`: the request failed. `broken`: the store answered with a wrong file. */
export type Read<T> = { ok: true; value: T } | { ok: false; problem: 'network' | 'broken'; reason: string };

export const SONGS = `${import.meta.env.BASE_URL}songs/`;
export const CACHE = 'beat-pals-songs';
const CACHED_NAME = /\/([0-9a-f]{64})\.bin$/u;
/**
 * A manifest fetch that hangs (a captive portal, a weak signal) stops after this long, as a lost network, so the
 * song list soon uses the last store on the device.
 */
const MANIFEST_TIMEOUT_MS = 4000;

export const fileUrl = (name: string): string => `${SONGS}${name}.bin`;

const broken = (reason: string): Read<never> => ({ ok: false, problem: 'broken', reason });

/**
 * Fetches a store URL past every HTTP cache. GitHub Pages sends `max-age=600`, so the manifest needs it. A store file
 * never changes, but the copy in Cache Storage is the only copy that the game needs. A stop through the signal is a
 * `network` result, as a lost network.
 */
const fetchStore = async (url: string, signal?: AbortSignal): Promise<Read<Response>> => {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: signal ?? null });
    return response.ok ? { ok: true, value: response } : broken(`${url} answered HTTP ${String(response.status)}`);
  } catch (error) {
    return { ok: false, problem: 'network', reason: error instanceof Error ? error.message : String(error) };
  }
};

/** Fetches and reads `manifest.json`. A fetch that takes longer than 4 s is a `network` result. */
export const fetchManifest = async (): Promise<Read<Manifest>> => {
  const response = await fetchStore(`${SONGS}manifest.json`, AbortSignal.timeout(MANIFEST_TIMEOUT_MS));
  if (!response.ok) {
    return response;
  }
  const text = await response.value.text().catch(() => undefined);
  if (text === undefined) {
    return { ok: false, problem: 'network', reason: 'the manifest stopped during the download' };
  }
  const manifest = readManifest(text);
  return manifest.ok ? manifest : broken(`the manifest is refused: ${manifest.reason}`);
};

/** The store names of the files in the cache. */
export const cachedNames = async (): Promise<Set<string>> => {
  const cache = await caches.open(CACHE);
  const requests = await cache.keys();
  return new Set(requests.flatMap((request) => CACHED_NAME.exec(new URL(request.url).pathname)?.[1] ?? []));
};

/**
 * Fetches one store file into the cache. The file must have its manifest size, open with the family key, and have
 * the keyed hash of its plain content as its name, so a damaged file never goes into the cache.
 */
export const downloadFile = async (
  key: FamilyKey,
  file: { name: string; size: number },
  signal?: AbortSignal
): Promise<Read<void>> => {
  const response = await fetchStore(fileUrl(file.name), signal);
  if (!response.ok) {
    return response;
  }
  const body = await response.value.arrayBuffer().catch(() => undefined);
  if (body === undefined) {
    return { ok: false, problem: 'network', reason: `${file.name}.bin stopped during the download` };
  }
  const bytes = new Uint8Array(body);
  if (bytes.length !== file.size) {
    return broken(`${file.name}.bin has ${String(bytes.length)} bytes, not ${String(file.size)}`);
  }
  const plain = await decryptFile(key, bytes);
  if (plain === undefined || (await storeName(key, plain)) !== file.name) {
    return broken(`${file.name}.bin does not open with the family key`);
  }
  const cache = await caches.open(CACHE);
  await cache.put(fileUrl(file.name), new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
  return { ok: true, value: undefined };
};

/** A read of a cached store file: its plain content, or why it failed. `missing`: not in the cache. `locked`: the
 * key does not open it, or it is damaged. */
export type CachedRead = { ok: true; plain: Uint8Array<ArrayBuffer> } | { ok: false; problem: 'missing' | 'locked' };

/** The bytes of a body. `onBytes` gets the length of each chunk as it arrives, for the progress of a load. */
const bodyBytes = async (response: Response, onBytes?: (count: number) => void): Promise<ArrayBuffer> => {
  if (onBytes === undefined || response.body === null) {
    return response.arrayBuffer();
  }
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform: (chunk, controller) => {
      onBytes(chunk.byteLength);
      controller.enqueue(chunk);
    },
  });
  return new Response(response.body.pipeThrough(counter)).arrayBuffer();
};

/** The plain content of a cached store file. `onBytes` counts its encrypted bytes as they are read. */
export const readCachedStream = async (
  key: FamilyKey,
  name: string,
  onBytes?: (count: number) => void
): Promise<CachedRead> => {
  const cache = await caches.open(CACHE);
  const response = await cache.match(fileUrl(name));
  if (response === undefined) {
    return { ok: false, problem: 'missing' };
  }
  const plain = await decryptFile(key, new Uint8Array(await bodyBytes(response, onBytes)));
  return plain === undefined ? { ok: false, problem: 'locked' } : { ok: true, plain };
};

/** The plain content of a cached store file, or undefined when it is not in the cache or does not open. */
export const readCachedFile = async (key: FamilyKey, name: string): Promise<Uint8Array<ArrayBuffer> | undefined> => {
  const read = await readCachedStream(key, name);
  return read.ok ? read.plain : undefined;
};

/** The plain song index from the cache. It downloads into the cache first when it is not there. */
const songIndexBytes = async (key: FamilyKey, manifest: Manifest): Promise<Read<Uint8Array<ArrayBuffer>>> => {
  const cached = await readCachedFile(key, manifest.index);
  if (cached !== undefined) {
    return { ok: true, value: cached };
  }
  const size = manifest.files.find((file) => file.name === manifest.index)?.size ?? 0;
  const downloaded = await downloadFile(key, { name: manifest.index, size });
  if (!downloaded.ok) {
    return downloaded;
  }
  const plain = await readCachedFile(key, manifest.index);
  return plain === undefined ? broken('the song index is not in the cache') : { ok: true, value: plain };
};

/** The song index of the manifest. */
export const loadSongIndex = async (key: FamilyKey, manifest: Manifest): Promise<Read<SongIndex>> => {
  const plain = await songIndexBytes(key, manifest);
  if (!plain.ok) {
    return plain;
  }
  const index = readSongIndex(new TextDecoder().decode(plain.value));
  return index.ok ? index : broken(`the song index is refused: ${index.reason}`);
};
