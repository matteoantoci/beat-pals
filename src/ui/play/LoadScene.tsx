import { createSignal, For, onCleanup, onSettled, Show } from 'solid-js';
import { ringFill } from '../../model';
import { palPicture, type PalIndex } from '../pals/pal-svg';
import { pictureOf } from '../songs/SongList';
import { LastSongCue } from './LastSongCue';
import { LoadDisc } from './LoadDisc';
import { reducedMotion } from './reduced-motion';
import type { LoadPhase } from '../../model';
import type { SongChoice } from '../songs/SongList';
import type { JSX } from '@solidjs/web';
import type { Accessor } from 'solid-js';

// The load scene (spec, "Screens", load scene): the cover of her song on a turning record, a fill ring around the
// record, and the pals on the stage floor in the ready state. It shows only when the load takes longer than
// SHOW_AFTER_MS, and then stays for at least SHOWN_MS, so a fast load does not flash. The load scene of the last song
// of a session shows at once, also for a song from the cache, and stays for at least LAST_SONG_MS (play-sessions
// spec, "Screens and motion"). It has the `data-last-song` mark. A failed load shows the oops moment: the ring and
// the record stop, the pals make the oops face, and the cover shakes. The load scene of the last song is the
// last-song cue (LastSongCue.tsx): a sunset with the record as the sun and the big pals on the hill.

const SHOW_AFTER_MS = 250;
const SHOWN_MS = 600;
const LAST_SONG_MS = 3200;
const FADE_MS = 200;
const OOPS_MS = 1500;
const PALS: readonly PalIndex[] = [0, 1, 2];

/** waiting: no scene yet. shown: the scene shows. closing: it fades out. closed: the play runs. failed: oops. */
type SceneState = 'waiting' | 'shown' | 'closing' | 'closed' | 'failed';

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
  const shownMs = lastSong ? LAST_SONG_MS : SHOWN_MS;
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
      await after(shownAt + shownMs - performance.now());
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

/** The cover picture of the song as an object URL, revoked when the scene closes. */
const coverOf = (choice: SongChoice): Accessor<string | undefined> => {
  const [picture, setPicture] = createSignal<string>();
  let closed = false;
  onSettled(() => {
    pictureOf(choice.key, choice.song).then(
      (url) => (closed ? URL.revokeObjectURL(url ?? '') : setPicture(url)),
      () => undefined
    );
  });
  onCleanup(() => {
    closed = true;
    URL.revokeObjectURL(picture() ?? '');
  });
  return picture;
};

type LoadSceneProps = {
  readonly choice: SongChoice;
  readonly phase: Accessor<LoadPhase>;
  readonly state: Accessor<SceneState>;
  /** The load of the last song of the session. */
  readonly lastSong: boolean;
};

export const LoadScene = (props: LoadSceneProps): JSX.Element => {
  const failed = (): boolean => props.state() === 'failed';
  const picture = coverOf(props.choice);
  const loadFill = (now: number): number => ringFill(props.phase(), now);
  // The scene of the last song shows at once, so the cue counts its time from here.
  const shownAt = performance.now();
  return (
    <div
      class={['load-scene stage-backdrop', { 'load-closing': props.state() === 'closing', 'load-failed': failed() }]}
      data-last-song={props.lastSong ? '' : undefined}
      aria-hidden="true"
    >
      <Show
        when={props.lastSong}
        fallback={
          <>
            <LoadDisc picture={picture()} fill={loadFill} stopped={failed} />
            <div class="pal-band load-band">
              <For each={PALS}>
                {(index) => (
                  <span class="band-pal">
                    <img src={palPicture(index, failed() ? 'oops' : 'ready')} alt="" draggable="false" />
                  </span>
                )}
              </For>
            </div>
          </>
        }
      >
        <LastSongCue
          picture={picture()}
          loadFill={loadFill}
          shownAt={shownAt}
          failed={failed()}
          reduce={reducedMotion()}
        />
      </Show>
    </div>
  );
};
