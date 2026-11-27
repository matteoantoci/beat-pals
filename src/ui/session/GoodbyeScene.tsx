import { onCleanup } from 'solid-js';
import { loadSoundOn } from '../../shell/settings';
import { playSceneSounds } from '../../sound';
import { GOODBYE_SEC, GOODBYE_SOUNDS } from '../night/goodbye';
import { NightStage } from '../night/NightStage';
import { reducedMotion } from '../play/reduced-motion';
import type { JSX } from '@solidjs/web';

// The goodbye scene (play-sessions spec, "Screens and motion"): the scene after the last song, from the wave to the
// sleep (src/ui/night/goodbye.ts). It lasts GOODBYE_SEC and ignores each tap, and then the night title shows. The
// caller sends the goodbye event before the scene shows, so the state is asleep for the whole scene, and a reload in
// it gives the night title. The scene never opens the safe window of an app update.

export const GoodbyeScene = (props: { readonly onDone: () => void }): JSX.Element => {
  const cancelSounds = playSceneSounds(GOODBYE_SOUNDS, loadSoundOn());
  const timer = setTimeout(() => props.onDone(), GOODBYE_SEC * 1000);
  onCleanup(() => {
    clearTimeout(timer);
    cancelSounds();
  });
  return <NightStage mode="goodbye" reduce={reducedMotion()} />;
};
