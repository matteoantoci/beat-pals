// The save of the device storage (spec, "Save"). Rules as in Pile Pals:
// - Write after each play, and on `visibilitychange` to hidden, because iOS can end the app with no other event.
// - A save that this build cannot read gives no progress, not an error.
// The settings, the songs, and the family key live outside the save, so a reset keeps them.

import { restore, outcomeOf, snapshot, songProgress, withSong } from '../model';
import type { PlayOutcome, SaveData, SavedProgress, SongProgress } from '../model';
import type { Codec, Slot } from './storage/slot';

/** The progress as JSON of the save data. A save that this build cannot read gives no progress. */
export const saveCodec: Codec<SavedProgress> = {
  absent: {},
  decode: (text) => {
    const result = restore(JSON.parse(text));
    return result.ok ? result.progress : undefined;
  },
  encode: (progress) => JSON.stringify(snapshot(progress)),
};

export type SaveStore = {
  /** The progress of one song: level 0 (no record) before its first play. */
  readonly progressOf: (songId: string) => SongProgress;
  /** Finds the outcome of a song play from its score, keeps the new progress, and writes the save. */
  readonly savePlay: (songId: string, score: number) => PlayOutcome;
  /** The save data of this device, for the save code. */
  readonly current: () => SaveData;
  /** Replaces the progress of this device with a restored progress, and writes it. False when the write failed. */
  readonly replace: (restored: SavedProgress) => boolean;
  /** Deletes the save (the reset of the parent area). False when the storage refused the change. */
  readonly clear: () => boolean;
  /** Writes the whole progress again, for example at a hide. False when the write failed. */
  readonly write: () => boolean;
};

export const saveStore = (progress: Slot<SavedProgress>): SaveStore => ({
  progressOf: (songId) => songProgress(progress.get(), songId),
  savePlay: (songId, score) => {
    const outcome = outcomeOf(songProgress(progress.get(), songId), score);
    // A failed write keeps the progress for this run; the next play or hide tries again.
    progress.set(withSong(progress.get(), songId, outcome.after));
    return outcome;
  },
  current: () => snapshot(progress.get()),
  replace: (restored) => progress.set(restored),
  clear: () => progress.clear(),
  write: () => progress.set(progress.get()),
});
