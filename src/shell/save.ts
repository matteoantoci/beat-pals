// The save in localStorage (spec, "Save"). Rules as in Pile Pals:
// - Write after each play, and on `visibilitychange` to hidden, because iOS can end the app with no other event.
// - A save that this build cannot read gives no progress, not an error.
// The settings, the songs, and the family key live outside the save, so a reset keeps them.

import { restore, outcomeOf, snapshot, songProgress, withSong } from '../model';
import type { PlayOutcome, SaveData, SavedProgress, SongProgress } from '../model';

/** The key of the save in localStorage. The schema version is inside the data (`SaveData.version`). */
const SAVE_KEY = 'beat-pals:save';

/** The progress of this device, read once from localStorage. */
let saved: SavedProgress | undefined;

const readSave = (): SavedProgress => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const result = raw === null ? undefined : restore(JSON.parse(raw));
    return result?.ok === true ? result.progress : {};
  } catch {
    // No storage, or damaged JSON: no progress.
    return {};
  }
};

const progress = (): SavedProgress => {
  saved ??= readSave();
  return saved;
};

/**
 * Writes the whole progress. A failed write (full storage, a blocked origin) must not stop the game, so it gives
 * false and the progress stays for this session.
 */
export const writeSave = (): boolean => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(progress())));
    return true;
  } catch {
    // No save this time; the next play tries again.
    return false;
  }
};

/** The save data of this device, for the save code. */
export const currentSave = (): SaveData => snapshot(progress());

/** Replaces the progress of this device with a restored progress, and writes it. False when the write failed. */
export const replaceProgress = (restored: SavedProgress): boolean => {
  saved = restored;
  return writeSave();
};

/** Deletes the save (the reset of the parent area). False when localStorage refused the change. */
export const clearSave = (): boolean => {
  saved = {};
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
};

/** The progress of one song: level 0 (no record) before its first play. */
export const progressOf = (songId: string): SongProgress => songProgress(progress(), songId);

/** Finds the outcome of a song play from its hit ratio, keeps the new progress, and writes the save. */
export const savePlay = (songId: string, ratio: number): PlayOutcome => {
  const outcome = outcomeOf(progressOf(songId), ratio);
  saved = withSong(progress(), songId, outcome.after);
  writeSave();
  return outcome;
};
