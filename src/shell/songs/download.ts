// The song download (spec, "Delivery", song download). It reads the manifest, then the song index, and then fetches
// the missing files of the download plan into Cache Storage, song by song and one file at a time. A cached file is
// skipped, so a new start after a stop continues from the next missing file.
// One download runs at a time. The screens watch its progress, so a screen that opens during a download shows it.
// The screen stays on during a download. After a complete download, the store is kept as the last store, and only
// then are the old files deleted. The setup mark follows the download: started, then done.

import { downloadPlan } from '../../model';
import { keepScreenOn } from '../wake-lock';
import { keepLastStore } from './last-store';
import { readSiteStore } from './read-store';
import { keepStorage, markSetup, setupMark } from './setup';
import { cachedNames, downloadFile } from './store';
import type { DownloadPlan, FamilyKey } from '../../model';
import type { SongStore } from './read-store';
import type { Read } from './store';

/** Each change of a running download: the plan after each file, and the end with its result. */
export type DownloadEvent = { type: 'progress'; plan: DownloadPlan } | { type: 'end'; result: SongStore };

type Run = { readonly key: FamilyKey; readonly signal: AbortSignal };
type Store = Extract<SongStore, { ok: true }>;

const listeners = new Set<(event: DownloadEvent) => void>();
let running: Promise<SongStore> | undefined;
let stopper: AbortController | undefined;
let latest: DownloadPlan | undefined;

const emit = (event: DownloadEvent): void => {
  if (event.type === 'progress') {
    latest = event.plan;
  }
  for (const listener of listeners) {
    listener(event);
  }
};

/**
 * Fetches the first missing file of the plan, and then goes on with the plan of the new cache, one file at a time.
 * Stops at the first failed file: the next plan starts there.
 */
const fetchFrom = async (store: Store, cached: Set<string>, run: Run): Promise<Read<DownloadPlan>> => {
  const [next] = store.plan.fetch;
  if (next === undefined) {
    return { ok: true, value: store.plan };
  }
  const fetched = await downloadFile(run.key, next, run.signal);
  if (!fetched.ok) {
    return fetched;
  }
  cached.add(next.name);
  const plan = downloadPlan(store.manifest, store.index, cached);
  emit({ type: 'progress', plan });
  return fetchFrom({ ...store, plan }, cached, run);
};

const download = async (run: Run): Promise<SongStore> => {
  const store = await readSiteStore(run.key);
  if (!store.ok) {
    return store;
  }
  emit({ type: 'progress', plan: store.plan });
  const fetched = await fetchFrom(store, await cachedNames(), run);
  if (!fetched.ok) {
    return fetched;
  }
  await keepLastStore(store.manifest, fetched.value.remove);
  markSetup('done');
  return { ...store, plan: { ...fetched.value, remove: [] } };
};

const failure = (error: unknown): SongStore => {
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return { ok: false, problem: 'broken', reason };
};

/**
 * Starts the download, or gives the download that runs. The result is the store after the download, or the
 * problem that stopped it. Start it again to continue after a stop. An error of the browser, for example a full
 * storage, is a `broken` result. A download before the end of the setup marks the setup as started.
 */
export const startDownload = (key: FamilyKey): Promise<SongStore> => {
  if (running !== undefined) {
    return running;
  }
  if (setupMark() !== 'done') {
    markSetup('started');
  }
  keepStorage().catch(() => undefined);
  const letSleep = keepScreenOn();
  const controller = new AbortController();
  stopper = controller;
  const run = download({ key, signal: controller.signal })
    .catch(failure)
    .then((result) => {
      letSleep();
      running = undefined;
      stopper = undefined;
      emit({ type: 'end', result });
      return result;
    });
  running = run;
  return run;
};

/** Stops a running download and waits for its end. The progress of the stopped download is forgotten. */
export const stopDownload = async (): Promise<void> => {
  stopper?.abort();
  await running;
  latest = undefined;
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
