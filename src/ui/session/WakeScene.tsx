import { onCleanup } from 'solid-js';
import { loadSoundOn } from '../../shell/settings';
import { playSceneSounds } from '../../sound';
import { NightStage } from '../night/NightStage';
import { WAKE_SEC, WAKE_SOUNDS } from '../night/wake';
import { reducedMotion } from '../play/reduced-motion';
import type { JSX } from '@solidjs/web';

// The wake-up scene (play-sessions spec, "Night title and wake-up"): the moon sets, the sky turns to dawn, the sun
// rises behind the logo and wakes it, and the pals stretch and yawn (src/ui/night/wake.ts). It plays at the first
// tap after the rest time, and after "Open a new session now". It lasts WAKE_SEC and ignores each tap. Then the
// normal title shows, and the caller starts the title music. The scene never opens the safe window of an app update.

export const WakeScene = (props: {
  /** The first light showed on the night title before the scene. */
  readonly firstLight: boolean;
  readonly onDone: () => void;
}): JSX.Element => {
  const cancelSounds = playSceneSounds(WAKE_SOUNDS, loadSoundOn());
  const timer = setTimeout(() => props.onDone(), WAKE_SEC * 1000);
  onCleanup(() => {
    clearTimeout(timer);
    cancelSounds();
  });
  return <NightStage mode="wake" reduce={reducedMotion()} firstLight={props.firstLight} />;
};
