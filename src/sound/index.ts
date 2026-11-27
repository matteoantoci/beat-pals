// The public interface of the sound module. The UI imports only from this file.
import { EFFECT_FILES } from './effects';
import { installAudio } from './engine';
import { fadeOutLoop, installLoop, playLoop, stopLoop } from './loop';

/** The title music: "Happy Adventure (Loop)" by TinyWorlds, CC0. */
const TITLE_MUSIC = 'music/title.mp3';
const TITLE_GAIN_DB = -6;

/** Call one time at start, before the first touch: the audio session, the preload of the title music and the sound
 * effects, the unlock on each tap, and the restart of the title music after a context replacement. */
export const installSound = (): void => {
  installAudio([TITLE_MUSIC, ...EFFECT_FILES]);
  installLoop();
};

/** Starts the title music, or keeps it playing. Call it from a tap. After a context replacement, it starts again
 * by itself until `stopTitleMusic` or `fadeOutTitleMusic`. */
export const playTitleMusic = (): void => {
  playLoop(TITLE_MUSIC, TITLE_GAIN_DB);
};

export { stopLoop as stopTitleMusic, fadeOutLoop as fadeOutTitleMusic };
export { playSceneSounds } from './scene';
export type { SceneSound, StopSounds } from './scene';
export { loadSong } from './song';
export type { Song, SongEvents } from './song';
