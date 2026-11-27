import { createSignal, For, onCleanup, onSettled, Show } from 'solid-js';
import { ringFill } from '../../model';
import { palPicture, type PalIndex } from '../pals/pal-svg';
import { pictureOf } from '../songs/SongList';
import { LastSongCue } from './LastSongCue';
import { LoadDisc } from './LoadDisc';
import { reducedMotion } from './reduced-motion';
import type { LoadPhase } from '../../model';
import type { SongChoice } from '../songs/SongList';
import type { SceneState } from './load-timing';
import type { JSX } from '@solidjs/web';
import type { Accessor } from 'solid-js';

// The load scene (spec, "Screens", load scene): the cover of her song on a turning record, a fill ring around the
// record, and the pals on the stage floor in the ready state. Its timing is in ./load-timing.ts. The load scene of
// the last song of a session has the `data-last-song` mark. A failed load shows the oops moment: the ring and
// the record stop, the pals make the oops face, and the cover shakes. The load scene of the last song is the
// last-song cue (LastSongCue.tsx): a sunset with the record as the sun and the big pals on the hill.

const PALS: readonly PalIndex[] = [0, 1, 2];

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
