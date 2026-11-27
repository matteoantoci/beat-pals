import { createSignal, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';

// The timing of the load scene (./LoadScene.tsx; spec, "Screens", load scene). The scene shows only when the load
// takes longer than SHOW_AFTER_MS, and then stays for at least SHOWN_MS, so a fast load does not flash. The load scene
// of the last song of a session shows at once, also for a song from the cache. The last song starts at LAST_SONG_MS
// or when the load ends, whichever is later (play-sessions spec, "Screens and motion"). Thus its close fade starts
// FADE_MS before LAST_SONG_MS. A slow load closes the scene when the load ends, and the play starts after the fade.

const SHOW_AFTER_MS = 250;
const SHOWN_MS = 600;
const LAST_SONG_MS = 3200;
const FADE_MS = 200;
const OOPS_MS = 1500;

/** waiting: no scene yet. shown: the scene shows. closing: it fades out. closed: the play runs. failed: oops. */
export type SceneState = 'waiting' | 'shown' | 'closing' | 'closed' | 'failed';

export type LoadSceneTiming = {
  readonly state: Accessor<SceneState>;
  /** The load is done: resolves when the scene is closed. */
  readonly loaded: () => Promise<void>;
  /** The load failed: shows the oops moment, and resolves at its end. */
  readonly failed: () => Promise<void>;
};

const after = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

/** The timing of the load scene for a play screen. For the last song, the scene shows at once. */
export const loadSceneTiming = (lastSong: boolean): LoadSceneTiming => {
  const [state, setState] = createSignal<SceneState>(lastSong ? 'shown' : 'waiting');
  let shownAt = performance.now();
  /** The time from the show to the start of the close fade. */
  const closeAfterMs = lastSong ? LAST_SONG_MS - FADE_MS : SHOWN_MS;
  const timer = lastSong
    ? undefined
    : setTimeout(() => {
        shownAt = performance.now();
        setState('shown');
      }, SHOW_AFTER_MS);
  onCleanup(() => clearTimeout(timer));
  const loaded = async (): Promise<void> => {
    clearTimeout(timer);
    if (state() === 'shown') {
      await after(shownAt + closeAfterMs - performance.now());
      setState('closing');
      await after(FADE_MS);
    }
    setState('closed');
  };
  const failed = async (): Promise<void> => {
    clearTimeout(timer);
    setState('failed');
    await after(OOPS_MS);
  };
  return { state, loaded, failed };
};
