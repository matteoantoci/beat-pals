import { onCleanup } from 'solid-js';
import { loadSoundOn } from '../../shell/settings';
import { playSceneSounds, type SceneSound } from '../../sound';

/** The body of a scene with a fixed length (./GoodbyeScene.tsx, ./WakeScene.tsx): it queues the sounds of the scene,
 * and calls `onDone` after `sec`. When the scene closes earlier, the sounds that did not start yet stop. */
export const playTimedScene = (sounds: readonly SceneSound[], sec: number, onDone: () => void): void => {
  const cancelSounds = playSceneSounds(sounds, loadSoundOn());
  const timer = setTimeout(onDone, sec * 1000);
  onCleanup(() => {
    clearTimeout(timer);
    cancelSounds();
  });
};
