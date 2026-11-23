// A read of the song store: the manifest of the site, its song index, and the download plan from the cache now.
// The screens read the store through `readSongStore`: when the site cannot answer, for example offline, the last
// complete store on the device stands in (spec, "Delivery", last manifest). The download reads the site only.

import { downloadPlan } from '../../model';
import { readLastStore } from './last-store';
import { cachedNames, fetchManifest, loadSongIndex } from './store';
import type { DownloadPlan, FamilyKey, Manifest, SongIndex } from '../../model';

/** Why the site store cannot be read. `wrong-key`: the store has another key id than the family key. */
export type StoreProblem = { problem: 'network' | 'broken' | 'wrong-key'; reason: string };

/**
 * The songs of the store: the manifest, its song index, and the plan from the cache now. `site`: the problem of the
 * site when the last complete store on the device stands in for it, else undefined.
 */
export type SongStore =
  | { ok: true; manifest: Manifest; index: SongIndex; plan: DownloadPlan; site: StoreProblem | undefined }
  | ({ ok: false } & StoreProblem);

/** Reads the manifest of the site and its song index (the index downloads first when it is not cached). */
export const readSiteStore = async (key: FamilyKey): Promise<SongStore> => {
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
  return { ok: true, manifest: manifest.value, index: index.value, plan, site: undefined };
};

/**
 * Reads the store of the site. When the site cannot be read, the last complete store on the device stands in, so
 * the ready songs still play. With no last store, the result is the problem of the site.
 */
export const readSongStore = async (key: FamilyKey): Promise<SongStore> => {
  const site = await readSiteStore(key);
  if (site.ok) {
    return site;
  }
  const last = await readLastStore(key);
  if (last === undefined) {
    return site;
  }
  const plan = downloadPlan(last.manifest, last.index, await cachedNames());
  return { ok: true, ...last, plan, site: { problem: site.problem, reason: site.reason } };
};
