import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { stopTitleMusic } from '../../sound';
import { BEADS } from './beads';
import { HoldButton } from './HoldButton';
import { LoadScene, loadSceneTiming, type LoadSceneTiming } from './LoadScene';
import { PauseScreen } from './PauseScreen';
import { loadPlay, type PlayHandle, type PlayHooks } from './play-load';
import type { LoadPhase } from '../../model';
import type { SongChoice } from '../songs/SongList';
import type { Accessor, JSX } from 'solid-js';

// The play screen (spec, "Screens"): the PixiJS canvas, the 3 pals as HTML pictures above it, the pause button, and
// the progress beads of the song. During the load, the load scene covers it and the title music plays on; the
// music stops when the play starts. A failed load shows the oops moment and goes back to the song list. At each
// hit, `data-last-hit` on this element gets the lane, the grade, and the song time (spec, "Testing Decisions").

type PlayScreenProps = {
  readonly choice: SongChoice;
  /** The hit ratio at the end of the song, or null for a play with no result. */
  readonly onEnd: (result: number | null) => void;
};

/** The pause button (a hold of 0.6 s) and the progress beads of the song, with no numbers. */
export const Hud = (props: { readonly onPause: () => void; readonly bead: (el: HTMLElement) => void }): JSX.Element => (
  <div class="play-hud">
    <HoldButton class="pause-button" label="Pause (parent: hold)" onHold={() => props.onPause()}>
      <svg class="pause-icon" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="4" y="3" width="4" height="14" rx="2" />
        <rect x="12" y="3" width="4" height="14" rx="2" />
      </svg>
    </HoldButton>
    <div class="play-beads" aria-hidden="true">
      <For each={Array.from({ length: BEADS })}>{() => <i ref={(el) => props.bead(el)} />}</For>
    </div>
    <div class="play-spacer" />
  </div>
);

type LoadView = {
  readonly phase: Accessor<LoadPhase>;
  readonly scene: LoadSceneTiming;
  readonly hooks: Pick<PlayHooks, 'onLoad' | 'onLoaded' | 'onFail'>;
};

/** The load scene of the play: the phase of the load, the scene timing, and the load hooks. After the oops moment
 * of a failed load, `onFailed` goes back, unless the screen closed. */
const loadView = (onFailed: () => void): LoadView => {
  const [phase, setPhase] = createSignal<LoadPhase>({ step: 'read', bytes: 0, total: 1 });
  const scene = loadSceneTiming();
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
    onFail: () => {
      scene.failed().then(
        () => closed || onFailed(),
        () => undefined
      );
    },
  };
  return { phase, scene, hooks };
};

export const PlayScreen = (props: PlayScreenProps): JSX.Element => {
  const [paused, setPaused] = createSignal(false);
  const { phase, scene, hooks } = loadView(() => props.onEnd(null));
  let root: HTMLElement | undefined;
  const pals: HTMLImageElement[] = [];
  const beads: HTMLElement[] = [];
  let handle: PlayHandle | undefined;
  onMount(() => {
    const canvas = root?.querySelector('canvas');
    const probe = root?.querySelector<HTMLElement>('.play-probe');
    if (root === undefined || !canvas || !probe) {
      return;
    }
    handle = loadPlay({ root, canvas, probe, pals, beads }, props.choice, {
      onPause: () => setPaused(true),
      onEnd: (result) => props.onEnd(result),
      ...hooks,
    });
    onCleanup(() => handle?.stop());
  });
  const resume = (): void => {
    setPaused(false);
    handle?.resume();
  };
  const sceneShows = (): boolean => scene.state() !== 'waiting' && scene.state() !== 'closed';
  return (
    <main
      class="play"
      classList={{ 'play-loading': scene.state() !== 'closed' }}
      ref={(el) => {
        root = el;
      }}
    >
      <canvas class="play-stage" />
      <For each={[0, 1, 2]}>
        {() => <img class="play-pal" alt="" hidden draggable={false} ref={(el) => pals.push(el)} />}
      </For>
      <div class="play-probe" />
      <Hud onPause={() => handle?.pause()} bead={(el) => beads.push(el)} />
      <Show when={sceneShows()}>
        <LoadScene choice={props.choice} phase={phase} state={scene.state} />
      </Show>
      <Show when={paused()}>
        <PauseScreen onPlay={resume} onHome={() => handle?.quit()} />
      </Show>
    </main>
  );
};
