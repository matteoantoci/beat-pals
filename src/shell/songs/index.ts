// The public interface of the songs on the device: the family key, the song download, and the ready songs.
// The UI imports only from this file.

export { checkKeyCode } from './key-check';
export type { KeyCheck } from './key-check';
export { loadFamilyKey } from './key-store';
export { downloading, lastProgress, readSongStore, startDownload, watchDownload } from './download';
export type { SongStore } from './download';
export { readCover, readSongFiles } from './song-files';
export type { SongFiles } from './song-files';
