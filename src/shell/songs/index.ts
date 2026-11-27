// The public interface of the songs on the device: the family key, the song download, the ready songs, and the
// state of the guided setup. The UI imports only from this file.

export { checkKeyCode } from './key-check';
export type { KeyCheck } from './key-check';
export { loadFamilyKey } from './key-store';
export { downloading, lastProgress, startDownload, watchDownload } from './download';
export { readSongStore } from './read-store';
export type { SongStore, StoreProblem } from './read-store';
export { forgetSongs } from './forget';
export { keepSongsFresh } from './fresh';
export { isStandalone, storageKept } from './setup';
export { readCover, readSongFiles } from './song-files';
export type { SongFiles } from './song-files';
