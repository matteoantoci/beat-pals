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

/**
 * Stops the sounds of a scene. Each sound that did not start yet stops. A sound that plays already rings out, or
 * stops too with `cut`.
 */
export type StopSounds = (playing?: 'ring-out' | 'cut') => void;

const nothing: StopSounds = () => undefined;

/** Queues the sounds in a context that runs. Each sound plays `late` seconds earlier. A sound whose time passed
 * already does not play: a late sound is wrong. */
const queueSounds = (ctx: AudioContext, sounds: readonly SceneSound[], late: number): StopSounds => {
  const now = ctx.currentTime;
  const queued = sounds.flatMap(({ effect, at }) => {
    if (at < late) {
      return [];
    }
    const when = now + at - late;
    const source = startEffect(ctx, { effect, rate: 1 }, when);
    return source ? [{ source, when }] : [];
  });
  return (playing = 'ring-out') => {
    for (const { source } of queued.filter(({ when }) => playing === 'cut' || when > ctx.currentTime)) {
      source.stop();
    }
  };
};

/**
 * Queues the sounds of a scene in a context that does not run yet. The first tap of a context starts it, but on iOS
 * the context runs only some time after the tap. So the sounds wait for it, and each sound moves back by the time
 * that passed. Thus the sounds stay in time with the scene.
 */
const queueWhenRunning = (ctx: AudioContext, sounds: readonly SceneSound[]): StopSounds => {
  const shownAt = performance.now();
  let stopQueued: StopSounds | undefined;
  const onChange = (): void => {
    if (ctx.state === 'running') {
      stopQueued = queueSounds(ctx, sounds, (performance.now() - shownAt) / 1000);
    }
    if (ctx.state === 'running' || ctx.state === 'closed') {
      ctx.removeEventListener('statechange', onChange);
    }
  };
  ctx.addEventListener('statechange', onChange);
  return (playing) => {
    ctx.removeEventListener('statechange', onChange);
    stopQueued?.(playing);
  };
};

/**
 * Queues the sounds of a scene from now. Gives the stop: a skip of the scene leaves no queued sound, and a sound that
 * plays already rings out; a failed load of the last-song cue cuts its tune. With the Sound effects switch off, no
 * sound plays.
 */
export const playSceneSounds = (sounds: readonly SceneSound[], on: boolean): StopSounds => {
  if (!on) {
    return nothing;
  }
  const ctx = currentContext();
  return ctx.state === 'running' ? queueSounds(ctx, sounds, 0) : queueWhenRunning(ctx, sounds);
};
