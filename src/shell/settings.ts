// The settings of the parent area in localStorage. They are not game data, so a reset of the game keeps them.

/** The key of the Sound effects switch. The value is "off" when the parent turned the sound effects off. */
const SOUND_KEY = 'beat-pals:sound';

/** The Sound effects switch (the claps and the level-up sounds): true (on) when there is no setting or localStorage
 * is blocked. The songs and the title music always play. */
export const loadSoundOn = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
};
