// The download plan of the song store (spec, "Delivery", song download). The game downloads the song index first,
// and then the missing files, song by song and one file at a time. A cached file is skipped, because its store
// name is the keyed hash of its plain content. So a plan made again after a stop continues from the next missing
// file, and the progress after each file is the plan of the new cache.

import type { IndexSong, Manifest, SongIndex } from '../store/manifest';

/** A store file to fetch: its store name and its encrypted size. */
type PlanFile = { name: string; size: number };

type Count = { songs: number; bytes: number };

export type DownloadPlan = {
  /** The missing files, song by song in the index order. A file that 2 songs share is fetched one time. */
  fetch: PlanFile[];
  /** The cached files that the manifest does not name. */
  remove: string[];
  /** The songs with all their files in the cache, in the index order. */
  ready: IndexSong[];
  /** All songs of the index and the size of their files. */
  total: Count;
  /** The ready songs, and the size of the song files in the cache. */
  done: Count;
};

const songFiles = (song: IndexSong): string[] => {
  const { facts, cover, audio } = song.files;
  return cover === null ? [facts, audio] : [facts, cover, audio];
};

const bytes = (list: readonly PlanFile[]): number => list.reduce((sum, file) => sum + file.size, 0);

/**
 * The plan from the manifest, its song index, and the store names in the cache. A song with a file that the
 * manifest does not name is left out: it can never be ready.
 */
export const downloadPlan = (manifest: Manifest, index: SongIndex, cached: ReadonlySet<string>): DownloadPlan => {
  const sizes = new Map(manifest.files.map((file) => [file.name, file.size]));
  const songs = index.songs.filter((song) => songFiles(song).every((file) => sizes.has(file)));
  // A Set keeps the first place of each file, so the order stays song by song.
  const files = [...new Set(songs.flatMap(songFiles))].map((name) => ({ name, size: sizes.get(name) ?? 0 }));
  const ready = songs.filter((song) => songFiles(song).every((file) => cached.has(file)));
  return {
    fetch: files.filter((file) => !cached.has(file.name)),
    remove: [...cached].filter((file) => !sizes.has(file)),
    ready,
    total: { songs: songs.length, bytes: bytes(files) },
    done: { songs: ready.length, bytes: bytes(files.filter((file) => cached.has(file.name))) },
  };
};
