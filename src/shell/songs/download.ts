// The song download (spec, "Delivery", song download). It reads the manifest, then the song index, and then fetches
// the missing files of the download plan into Cache Storage, song by song and one file at a time. A cached file is
// skipped, so a new start after a stop continues from the next missing file.
// One download runs at a time. The screens watch its progress, so a screen that opens during a download shows it.

import { downloadPlan } from '../../model';
import { cachedNames, downloadFile, fetchManifest, loadSongIndex } from './store';
import type { DownloadPlan, FamilyKey, Manifest, SongIndex } from '../../model';
import type { Read } from './store';

/**
 * The songs of the store: the manifest, its song index, and the plan from the cache now. `wrong-key`: the store
 * has another key id than the family key.
 */
export type SongStore =
  | { ok: true; manifest: Manifest; index: SongIndex; plan: DownloadPlan }
  | { ok: false; problem: 'network' | 'broken' | 'wrong-key'; reason: string };

/** Each change of a running download: the plan after each file, and the end with its result. */
export type DownloadEvent = { type: 'progress'; plan: DownloadPlan } | { type: 'end'; result: SongStore };

const listeners = new Set<(event: DownloadEvent) => void>();
let running: Promise<SongStore> | undefined;
let latest: DownloadPlan | undefined;

const emit = (event: DownloadEvent): void => {
  if (event.type === 'progress') {
    latest = event.plan;
  }
  for (const listener of listeners) {
    listener(event);
  }
};

/** Reads the manifest and the song index (the index downloads first when it is not cached), and makes the plan. */
export const readSongStore = async (key: FamilyKey): Promise<SongStore> => {
  const manifest = await fetchManifest();
  if (!manifest.ok) {
    return manifest;
  }
  if (manifest.value.keyId !== key.id) {
    return { ok: false, problem: 'wrong-key', reason: `the store has the key id ${manifest.value.keyId}` };
  }
  const index = await loadSongIndex(key, manifest.value);
  if (!index.ok) {
    return index;
  }
  const plan = downloadPlan(manifest.value, index.value, await cachedNames());
  return { ok: true, manifest: manifest.value, index: index.value, plan };
};

type Store = Extract<SongStore, { ok: true }>;

/**
 * Fetches the first missing file of the plan, and then goes on with the plan of the new cache, one file at a time.
 * Stops at the first failed file: the next plan starts there.
 */
const fetchFrom = async (key: FamilyKey, store: Store, cached: Set<string>): Promise<Read<DownloadPlan>> => {
  const [next] = store.plan.fetch;
  if (next === undefined) {
    return { ok: true, value: store.plan };
  }
  const fetched = await downloadFile(key, next);
  if (!fetched.ok) {
    return fetched;
  }
  cached.add(next.name);
  const plan = downloadPlan(store.manifest, store.index, cached);
  emit({ type: 'progress', plan });
  return fetchFrom(key, { ...store, plan }, cached);
};

const download = async (key: FamilyKey): Promise<SongStore> => {
  const store = await readSongStore(key);
  if (!store.ok) {
    return store;
  }
  emit({ type: 'progress', plan: store.plan });
  const fetched = await fetchFrom(key, store, await cachedNames());
  return fetched.ok ? { ...store, plan: fetched.value } : fetched;
};

/**
 * Starts the download, or gives the download that runs. The result is the store after the download, or the
 * problem that stopped it. Start it again to continue after a stop. An error of the browser, for example a full
 * storage, is a `broken` result.
 */
export const startDownload = (key: FamilyKey): Promise<SongStore> => {
  running ??= download(key)
    .catch((error: unknown): SongStore => {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return { ok: false, problem: 'broken', reason };
    })
    .then((result) => {
      running = undefined;
      emit({ type: 'end', result });
      return result;
    });
  return running;
};

/** True while a download runs. */
export const downloading = (): boolean => running !== undefined;

/** The plan of the last progress event, for a screen that opens during a download. */
export const lastProgress = (): DownloadPlan | undefined => latest;

/** Calls the listener at each event of a download. Returns the function that removes it. */
export const watchDownload = (listener: (event: DownloadEvent) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
