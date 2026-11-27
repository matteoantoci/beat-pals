import { createSignal, For, onCleanup, onSettled } from 'solid-js';
import { ringFill } from '../../model';
import { palPicture, type PalIndex } from '../pals/pal-svg';
import { pictureOf, SongPicture } from '../songs/SongList';
import type { LoadPhase } from '../../model';
import type { SongChoice } from '../songs/SongList';
import type { JSX } from '@solidjs/web';
import type { Accessor } from 'solid-js';

// The load scene (spec, "Screens", load scene): the cover of her song on a turning record, a fill ring around the
// record, and the pals on the stage floor in the ready state. It shows only when the load takes longer than
// SHOW_AFTER_MS, and then stays for at least SHOWN_MS, so a fast load does not flash. The load scene of the last song
// of a session shows at once, also for a song from the cache, and stays for at least LAST_SONG_MS (play-sessions
// spec, "Screens and motion"). It has the `data-last-song` mark. A failed load shows the oops moment: the ring and
// the record stop, the pals make the oops face, and the cover shakes.

const SHOW_AFTER_MS = 250;
const SHOWN_MS = 600;
const LAST_SONG_MS = 3200;
const FADE_MS = 200;
const OOPS_MS = 1500;
/** The share of the distance to the target that the ring moves in each frame, so a step never jumps. */
const EASE = 0.18;

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

type Ring = {
  readonly ring: SVGCircleElement;
  readonly phase: Accessor<LoadPhase>;
  readonly stopped: () => boolean;
};

/** Moves the ring towards the fill of the load phase in each frame. The ring never goes back, and it stops at a
 * failure. `data-fill` on the ring gives the fill in percent. Gives the function that stops the frames. */
const runRing = ({ ring, phase, stopped }: Ring): (() => void) => {
  let shown = 0;
  let frame = 0;
  const draw = (): void => {
    if (!stopped()) {
      const target = ringFill(phase(), performance.now());
      const next = shown + (target - shown) * EASE;
      shown = Math.max(shown, target - next < 0.002 ? target : next);
      ring.setAttribute('stroke-dasharray', `${(shown * 100).toFixed(2)} 100`);
      ring.setAttribute('data-fill', String(Math.round(shown * 100)));
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
};

type LoadDiscProps = {
  readonly choice: SongChoice;
  readonly phase: Accessor<LoadPhase>;
  readonly stopped: () => boolean;
};

/** The cover of the song on the turning record, with the fill ring around the record. */
const LoadDisc = (props: LoadDiscProps): JSX.Element => {
  const picture = coverOf(props.choice);
  let ring: SVGCircleElement | undefined;
  onSettled(() => (ring ? runRing({ ring, phase: props.phase, stopped: props.stopped }) : undefined));
  return (
    <div class="load-disc">
      <svg viewBox="0 0 120 120">
        <circle class="logo-shadow" cx="60" cy="64" r="52" />
        <g class="load-record">
          <circle class="logo-record" cx="60" cy="60" r="52" />
          <circle class="logo-groove" cx="60" cy="60" r="45" />
          <circle class="logo-groove" cx="60" cy="60" r="39" />
          <path class="logo-arc logo-arc-berry" d="M60 10 A50 50 0 0 1 95 24" />
          <path class="logo-arc logo-arc-mint" d="M60 110 A50 50 0 0 1 25 96" />
        </g>
        <path class="logo-shine" d="M20 40 A44 44 0 0 1 40 18" />
        <circle class="load-ring-track" cx="60" cy="60" r="58" />
        <circle
          class="load-ring"
          cx="60"
          cy="60"
          r="58"
          pathLength="100"
          stroke-dasharray="0 100"
          ref={(el) => {
            ring = el;
          }}
        />
      </svg>
      <div class="load-cover">
        <SongPicture picture={picture()} />
      </div>
    </div>
  );
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
  return (
    <div
      class={['load-scene stage-backdrop', { 'load-closing': props.state() === 'closing', 'load-failed': failed() }]}
      data-last-song={props.lastSong ? '' : undefined}
      aria-hidden="true"
    >
      <LoadDisc choice={props.choice} phase={props.phase} stopped={failed} />
      <div class="pal-band load-band">
        <For each={PALS}>
          {(index) => (
            <span class="band-pal">
              <img src={palPicture(index, failed() ? 'oops' : 'ready')} alt="" draggable="false" />
            </span>
          )}
        </For>
      </div>
    </div>
  );
};
