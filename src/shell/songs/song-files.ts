// The files of a ready song, read from Cache Storage and decrypted in memory (spec, "Delivery", play).

import { readCachedFile, readCachedStream } from './store';
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

/** A read of the files of a song: the files, or why a file failed (see `CachedRead`). */
type SongFilesRead = { ok: true; files: SongFiles } | { ok: false; problem: 'missing' | 'locked' };

/**
 * All files of a ready song. `onBytes` counts their encrypted bytes as they are read; the sum of all counts is the
 * `size` of the song in the index.
 */
export const readSongFiles = async (
  key: FamilyKey,
  song: IndexSong,
  onBytes?: (count: number) => void
): Promise<SongFilesRead> => {
  const { facts, audio, cover, coverType } = song.files;
  const [factsRead, audioRead, coverRead] = await Promise.all([
    readCachedStream(key, facts, onBytes),
    readCachedStream(key, audio, onBytes),
    cover === null ? undefined : readCachedStream(key, cover, onBytes),
  ]);
  if (!factsRead.ok) {
    return factsRead;
  }
  if (!audioRead.ok) {
    return audioRead;
  }
  if (coverRead?.ok === false) {
    return coverRead;
  }
  const picture =
    coverRead?.ok === true && coverType !== null ? new Blob([coverRead.plain], { type: coverType }) : null;
  return {
    ok: true,
    files: { factsJson: new TextDecoder().decode(factsRead.plain), cover: picture, audio: audioRead.plain.buffer },
  };
};
