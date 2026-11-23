// The save data (spec, "Save"): a version number and the progress of each song, by song id. All data is plain JSON,
// so localStorage and a save code can hold it. The progress map has a null prototype, and a restore accepts only
// song ids that match `^[a-z0-9-]+$`, so no id of a save can reach `Object.prototype`. A song id that is not in the
// song list stays in the save, so a song that returns keeps its stars.

import { NEW_SONG, type SongProgress } from './progress';

/**
 * The schema version of `SaveData`. A save with another version is not read.
 * Raise this number when `restore` cannot read the data of the older version.
 */
const SAVE_VERSION = 1;

/** The progress of each song with a play, by song id. Songs with no play are not in it. */
export type SavedProgress = Readonly<Record<string, SongProgress>>;

type SaveData = { readonly version: number; readonly progress: SavedProgress };

/** Why `restore` refused a save. `version`: a schema version that this build does not know. `shape`: not save data. */
type RestoreFailure = 'version' | 'shape';

type RestoreResult =
  | { readonly ok: true; readonly progress: SavedProgress }
  | { readonly ok: false; readonly reason: RestoreFailure };

const SONG_ID = /^[a-z0-9-]+$/u;
const COLORS: ReadonlySet<unknown> = new Set([0, 1, 2, 3, 4]);
const STARS: ReadonlySet<unknown> = new Set([0, 1, 2, 3]);
const WEAK_PLAYS: ReadonlySet<unknown> = new Set([0, 1, 2]);
const SHAPE: RestoreResult = { ok: false, reason: 'shape' };

const isColor = (value: unknown): value is SongProgress['color'] => COLORS.has(value);
const isStars = (value: unknown): value is SongProgress['stars'] => STARS.has(value);
const isWeakPlays = (value: unknown): value is SongProgress['weakPlays'] => WEAK_PLAYS.has(value);

/** The fields of a plain object, or undefined for any other value. */
const fieldsOf = (value: unknown): ReadonlyMap<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? new Map(Object.entries(value)) : undefined;

/** The progress of one song, or undefined when a value is out of its range. Other fields are left out. 3 stars
 * exist only at diamond: the third star of another color opens the next color. */
const progressFrom = (value: unknown): SongProgress | undefined => {
  const fields = fieldsOf(value);
  const color = fields?.get('color');
  const stars = fields?.get('stars');
  const weakPlays = fields?.get('weakPlays');
  return isColor(color) && isStars(stars) && isWeakPlays(weakPlays) && (stars !== 3 || color === 4)
    ? { color, stars, weakPlays }
    : undefined;
};

/** A progress map with a null prototype, so no song id reaches `Object.prototype`. */
const progressMap = (songs: Iterable<readonly [string, SongProgress]>): SavedProgress => {
  const map: Record<string, SongProgress> = {};
  Object.setPrototypeOf(map, null);
  for (const [songId, progress] of songs) {
    map[songId] = progress;
  }
  return map;
};

/** The progress of a song: bronze with 0 stars when the song has no play yet. */
export const songProgress = (saved: SavedProgress, songId: string): SongProgress =>
  Object.hasOwn(saved, songId) ? (saved[songId] ?? NEW_SONG) : NEW_SONG;

/** A copy of the saved progress with the progress of one song set. */
export const withSong = (saved: SavedProgress, songId: string, progress: SongProgress): SavedProgress =>
  progressMap([...Object.entries(saved), [songId, progress]]);

/** The save data of the progress. */
export const snapshot = (progress: SavedProgress): SaveData => ({ version: SAVE_VERSION, progress });

/**
 * Reads save data that comes from localStorage or from a save code. It never throws: a save that this build
 * cannot read gives a failure reason, and the game starts with no progress. An entry with a song id that does not
 * match `^[a-z0-9-]+$` is left out.
 */
export const restore = (save: unknown): RestoreResult => {
  const fields = fieldsOf(save);
  const version = fields?.get('version');
  if (typeof version !== 'number') {
    return SHAPE;
  }
  if (version !== SAVE_VERSION) {
    return { ok: false, reason: 'version' };
  }
  const saved = fieldsOf(fields?.get('progress'));
  if (saved === undefined) {
    return SHAPE;
  }
  const songs = [...saved].flatMap(([songId, value]) => {
    const progress = progressFrom(value);
    return progress === undefined ? [] : [[songId, progress] as const];
  });
  if (songs.length !== saved.size) {
    return SHAPE;
  }
  return { ok: true, progress: progressMap(songs.filter(([songId]) => SONG_ID.test(songId))) };
};
