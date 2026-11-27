import { createSignal, onCleanup, onSettled, Show } from 'solid-js';
import { stopTitleMusic } from '../../sound';
import { useStorage } from '../storage';
import { livePlay } from './live-play';
import { loadSceneTiming, type LoadSceneTiming } from './load-timing';
import { LoadScene } from './LoadScene';
import { PauseScreen } from './PauseScreen';
import { createPlay, type Play, type PlayHooks, type PlayResult } from './play-load';
import { PlayLayers, playRefs } from './PlayLayers';
import type { LoadPhase } from '../../model';
import type { DeviceStorage } from '../../shell/storage';
import type { SongChoice } from '../songs/SongList';
import type { JSX } from '@solidjs/web';
import type { Accessor } from 'solid-js';

// The play screen (spec, "Screens"): the play layers (PlayLayers.tsx) and the live play of the song. During the load,
// the load scene covers it and the title music plays on (the last-song cue fades it out); the music stops when the
// play starts. A failed load keeps its reason for the parent area, shows the oops moment, and goes back to the song
// list. A song that plays ends the last load problem. At each hit, `data-last-hit` on this element gets the lane, the
// grade, and the song time (spec, "Testing Decisions").
// The screen gives 3 different results: a score, a failed load, and Home on the pause screen (play-sessions spec,
// "Session rules").

type PlayScreenProps = {
  readonly choice: SongChoice;
  /** The last song of the session: its load scene shows at once and stays longer. */
  readonly lastSong: boolean;
  readonly onEnd: (result: PlayResult) => void;
};

type LoadView = {
  readonly phase: Accessor<LoadPhase>;
  readonly scene: LoadSceneTiming;
  readonly hooks: Pick<PlayHooks, 'onLoad' | 'onLoaded' | 'onStarted' | 'onFail'>;
};

/** The load scene of the play: the phase of the load, the scene timing, and the load hooks. After the oops moment
 * of a failed load, `onFailed` goes back, unless the screen closed. */
const loadView = (lastSong: boolean, storage: DeviceStorage, onFailed: () => void): LoadView => {
  const [phase, setPhase] = createSignal<LoadPhase>({ step: 'read', bytes: 0, total: 1 });
  const scene = loadSceneTiming(lastSong);
  let closed = false;
  onCleanup(() => {
    closed = true;
  });
  const hooks: LoadView['hooks'] = {
    onLoad: setPhase,
    onLoaded: async () => {
      await scene.loaded();
      stopTitleMusic();
    },
    // A missing file that downloaded again is no fault anymore.
    onStarted: () => storage.loadProblem.clear(),
    onFail: ({ problem }) => {
      storage.loadProblem.set({ kind: problem, at: Date.now() });
      scene.failed().then(
        () => closed || onFailed(),
        () => undefined
      );
    },
  };
  return { phase, scene, hooks };
};

export const PlayScreen = (props: PlayScreenProps): JSX.Element => {
  const storage = useStorage();
  const [paused, setPaused] = createSignal(false);
  const { phase, scene, hooks } = loadView(props.lastSong, storage, () => props.onEnd({ kind: 'failed' }));
  const refs = playRefs();
  let play: Play | undefined;
  onSettled(() => {
    const elements = refs.elements();
    if (elements !== undefined) {
      const adapter = livePlay({ elements, choice: props.choice, storage });
      play = createPlay(adapter, { ...hooks, onPause: () => setPaused(true), onEnd: (result) => props.onEnd(result) });
    }
    return () => play?.dispose();
  });
  const resume = (): void => {
    setPaused(false);
    play?.resume();
  };
  const sceneShows = (): boolean => scene.state() !== 'waiting' && scene.state() !== 'closed';
  return (
    <main class={['play', { 'play-loading': scene.state() !== 'closed' }]} ref={refs.root}>
      <PlayLayers refs={refs} onPause={() => play?.pause()} />
      <Show when={sceneShows()}>
        <LoadScene choice={props.choice} phase={phase} state={scene.state} lastSong={props.lastSong} />
      </Show>
      <Show when={paused()}>
        <PauseScreen onPlay={resume} onHome={() => play?.quit()} />
      </Show>
    </main>
  );
};
