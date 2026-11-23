// The public interface of the sound module. The UI imports only from this file.
import { installAudio, playLoop, stopLoop } from './engine';

/** The title music: "Happy Adventure (Loop)" by TinyWorlds, CC0. */
const TITLE_MUSIC = 'music/title.mp3';
const TITLE_GAIN_DB = -6;

/** Call one time at start, before the first touch: the audio session, the preload, and the unlock on each tap. */
export const installSound = (): void => {
  installAudio([TITLE_MUSIC]);
};

/** Starts the title music, or keeps it playing. Call it from a tap. After a context replacement, it starts again
 * by itself until `stopTitleMusic`. */
export const playTitleMusic = (): void => {
  playLoop(TITLE_MUSIC, TITLE_GAIN_DB);
};

export { stopLoop as stopTitleMusic };
export { loadSong } from './song';
export type { Song, SongEvents } from './song';
