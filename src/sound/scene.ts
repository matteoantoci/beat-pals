// The sounds of a scene on the audio clock, at the moments of the scene timeline: the record, the star, and the join
// of the end scene (spec, "Screens", end scene; src/ui/end/motion.ts), and the 5 sounds of the session scenes
// (play-sessions spec, "Sound effects").
import { startEffect } from './effects';
import { currentContext } from './engine';

/** The sounds of the session scenes: the last-song cue, the sun step on the song list, the yawn of the end scene
 * and the wake-up scene, the goodbye scene, and the sunrise of the wake-up scene. */
type SessionSound = 'last-song' | 'sun-step' | 'yawn' | 'goodbye' | 'wake-up';

/** One sound of a scene, and its time in seconds after the start of the scene. */
export type SceneSound = { readonly effect: 'record' | 'star' | 'join' | SessionSound; readonly at: number };

const nothing = (): void => undefined;

/**
 * Queues the sounds of a scene from now. Gives the cancel: it stops each sound that did not start yet, so a
 * skip of the scene leaves no queued sound, and a sound that plays already rings out. With the Sound effects switch
 * off, or a context that does not run (its sounds would come late, after the next tap), no sound plays.
 */
export const playSceneSounds = (sounds: readonly SceneSound[], on: boolean): (() => void) => {
  const ctx = currentContext();
  if (!on || ctx.state !== 'running') {
    return nothing;
  }
  const now = ctx.currentTime;
  const queued = sounds.flatMap(({ effect, at }) => {
    const when = now + at;
    const source = startEffect(ctx, { effect, rate: 1 }, when);
    return source ? [{ source, when }] : [];
  });
  return () => {
    for (const { source } of queued.filter(({ when }) => when > ctx.currentTime)) {
      source.stop();
    }
  };
};
