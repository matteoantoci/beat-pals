// The files of a ready song, read from Cache Storage and decrypted in memory (spec, "Delivery", play).

import { readCachedFile } from './store';
import type { FamilyKey, IndexSong } from '../../model';

/** A ready song, decrypted: the facts file as JSON text, the cover picture, and the encoded audio. */
export type SongFiles = {
  /** The text of the facts file (`SongFacts`). */
  factsJson: string;
  /** The cover picture, or null for a song with a plain card. */
  cover: Blob | null;
  /** The encoded `.m4a` audio, for `decodeAudioData`. */
  audio: ArrayBuffer;
};

/** The cover picture of a song, or null when the song has none or its file is not in the cache. */
export const readCover = async (key: FamilyKey, song: IndexSong): Promise<Blob | null> => {
  const { cover, coverType } = song.files;
  if (cover === null || coverType === null) {
    return null;
  }
  const bytes = await readCachedFile(key, cover);
  return bytes === undefined ? null : new Blob([bytes], { type: coverType });
};

/** All files of a ready song, or undefined when a file is not in the cache or does not open with the key. */
export const readSongFiles = async (key: FamilyKey, song: IndexSong): Promise<SongFiles | undefined> => {
  const [facts, audio] = await Promise.all([
    readCachedFile(key, song.files.facts),
    readCachedFile(key, song.files.audio),
  ]);
  if (facts === undefined || audio === undefined) {
    return undefined;
  }
  const cover = await readCover(key, song);
  if (song.files.cover !== null && cover === null) {
    return undefined;
  }
  return { factsJson: new TextDecoder().decode(facts), cover, audio: audio.buffer };
};
