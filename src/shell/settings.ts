// The settings of the parent area in localStorage. They are not game data, so a reset of the game keeps them.

/** The key of the Sound effects switch. The value is "off" when the parent turned the sound effects off. */
const SOUND_KEY = 'beat-pals:sound';

/** The switch of this session: read once, and set by the parent area, also when localStorage refuses the write. */
let soundOn: boolean | undefined;

const readSoundOn = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
};

/** The Sound effects switch (the claps and the level-up sounds): true (on) when there is no setting or localStorage
 * is blocked. The songs and the title music always play. */
export const loadSoundOn = (): boolean => {
  soundOn ??= readSoundOn();
  return soundOn;
};

/** Keeps the Sound effects switch for the next launch. A failed write keeps the switch for this session only. */
export const storeSoundOn = (on: boolean): void => {
  soundOn = on;
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // The switch works until the app closes.
  }
};
