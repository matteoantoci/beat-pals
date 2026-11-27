import { onCleanup } from 'solid-js';
import { playSceneSounds, type SceneSound } from '../../sound';
import { useStorage } from '../storage';

/** The body of a scene with a fixed length (./GoodbyeScene.tsx, ./WakeScene.tsx): it queues the sounds of the scene,
 * and calls `onDone` after `sec`. When the scene closes earlier, the sounds that did not start yet stop. Call it in
 * the setup of the scene component. */
export const playTimedScene = (sounds: readonly SceneSound[], sec: number, onDone: () => void): void => {
  const cancelSounds = playSceneSounds(sounds, useStorage().sound.get());
  const timer = setTimeout(onDone, sec * 1000);
  onCleanup(() => {
    clearTimeout(timer);
    cancelSounds();
  });
};
