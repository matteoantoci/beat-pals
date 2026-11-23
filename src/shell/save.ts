// The save in localStorage (spec, "Save"). Rules as in Pile Pals:
// - Write after each play, and on `visibilitychange` to hidden, because iOS can end the app with no other event.
// - A save that this build cannot read gives no progress, not an error.
// The settings live outside the save, so a reset keeps them.

import { restore, scorePlay, snapshot, songProgress, withSong } from '../model';
import type { PlayScore, SavedProgress, SongProgress } from '../model';

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

/** Writes the whole progress. A failed write (full storage, a blocked origin) must not stop the game. */
export const writeSave = (): void => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(progress())));
  } catch {
    // No save this time; the next play tries again.
  }
};

/** The progress of one song: bronze with 0 stars before its first play. */
export const progressOf = (songId: string): SongProgress => songProgress(progress(), songId);

/** Scores the play of a song with its hit ratio, keeps the new progress, and writes the save. */
export const savePlay = (songId: string, ratio: number): PlayScore => {
  const score = scorePlay(progressOf(songId), ratio);
  saved = withSong(progress(), songId, score.after);
  writeSave();
  return score;
};
