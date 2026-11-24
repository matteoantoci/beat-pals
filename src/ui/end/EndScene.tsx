import { createSignal, onSettled, Show } from 'solid-js';
import { bandOf, danceOf, RECORD_COLORS } from '../../model';
import { loadSoundOn } from '../../shell/settings';
import { playSceneSounds } from '../../sound';
import { reducedMotion, watchReducedMotion } from '../play/reduced-motion';
import { pictureOf, type SongChoice } from '../songs/SongList';
import { playScene, sceneLength, sceneSounds, type ScenePlan, type SceneParts } from './motion';
import { Band, Sleeve, StarRow, type Refs } from './parts';
import type { PlayOutcome } from '../../model';
import type { JSX } from '@solidjs/web';

// The end scene (spec, "Screens"): the result of the play in pictures, with no numbers. The record of the play
// slides out of the song sleeve, a new star flies to its place, a new record color slides out after a third star,
// and at silver and gold the new pal jumps into the band (the join scene). The pals dance by the hit ratio. The
// record, the star, and the join have their sounds (Sound effects switch). Then one button goes back to the song list.
// Taps: each `pointerdown` in the first 2 s does nothing, and a pointer that went down before the scene never
// gives a `pointerdown` here. After that, one tap skips to the final state, and the sounds still to come do not
// play: a skip never leaves a sound queued, and never plays one twice. The button reacts only to a pointer
// that went down on the button itself, so the skip tap never presses it, also when iOS sends its click to the
// button that shows under the finger.

/** The first 2 s of the scene ignore each tap. */
const DEAF_MS = 2000;

type EndSceneProps = {
  readonly choice: SongChoice;
  /** The hit ratio of the play. */
  readonly ratio: number;
  readonly outcome: PlayOutcome;
  readonly onDone: () => void;
};

const ignore = (): void => undefined;

const sceneParts = (refs: Refs): SceneParts | undefined => {
  const { root, cover, record, confetti } = refs;
  if (root === undefined || cover === undefined || record === undefined || confetti === undefined) {
    return undefined;
  }
  const { newRecord, starSparks, landSparks, stars, bodies, pals } = refs;
  return { root, cover, record, confetti, newRecord, starSparks, landSparks, stars, bodies, pals };
};

/** Starts the motion and the sounds of the scene. Gives the skip: each part in its final state, and no sound still
 * to come. */
const startScene = (refs: Refs, plan: ScenePlan): (() => void) => {
  const parts = sceneParts(refs);
  if (parts === undefined) {
    return ignore;
  }
  const finishMotion = playScene(parts, plan, reducedMotion());
  const cancelSounds = playSceneSounds(sceneSounds(plan), loadSoundOn());
  return () => {
    finishMotion();
    cancelSounds();
  };
};

/** Skips the scene at a change to reduced motion, and finishes it at its end. Gives the function that stops both. */
const watchScene = (plan: ScenePlan, skip: () => void, finish: () => void): (() => void) => {
  // A change to reduced motion during the scene stops each motion: the parts jump to their final state.
  const unwatch = watchReducedMotion((reduced) => reduced && skip());
  const timer = setTimeout(finish, sceneLength(plan) * 1000);
  return () => {
    clearTimeout(timer);
    unwatch();
  };
};

/** The button back to the song list: the 4 squares of the prototype. It reacts only to a pointer that went down
 * on it, or to a keyboard press (no pointer: `detail` 0). */
const DoneButton = (props: { readonly onDone: () => void }): JSX.Element => {
  let armed = false;
  return (
    <button
      type="button"
      class="end-done"
      aria-label="Back to the songs"
      onPointerDown={() => {
        armed = true;
      }}
      onClick={(event) => (armed || event.detail === 0) && props.onDone()}
    >
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <rect x="3" y="3" width="10" height="10" rx="2" />
        <rect x="15" y="3" width="10" height="10" rx="2" />
        <rect x="3" y="15" width="10" height="10" rx="2" />
        <rect x="15" y="15" width="10" height="10" rx="2" />
      </svg>
    </button>
  );
};

export const EndScene = (props: EndSceneProps): JSX.Element => {
  const plan: ScenePlan = {
    star: props.outcome.star,
    opened: props.outcome.opened !== null,
    joins: props.outcome.joins,
    dance: danceOf(props.ratio),
    band: bandOf(RECORD_COLORS[props.outcome.before.color]),
  };
  const refs: Refs = { stars: [], bodies: [], pals: [] };
  const [picture, setPicture] = createSignal<string>();
  const [done, setDone] = createSignal(false);
  const shownAt = performance.now();
  let skip = ignore;
  const finish = (): void => {
    if (!done()) {
      skip();
      setDone(true);
    }
  };
  onSettled(() => {
    pictureOf(props.choice.key, props.choice.song).then(setPicture, ignore);
    skip = startScene(refs, plan);
    const stopWatches = watchScene(plan, skip, finish);
    return () => {
      stopWatches();
      skip(); // The exit cancels the sounds still to come.
      URL.revokeObjectURL(picture() ?? '');
    };
  });
  const tap = (): void => {
    if (performance.now() - shownAt >= DEAF_MS) {
      finish();
    }
  };
  return (
    <main class="end" ref={(el) => Object.assign(refs, { root: el })} onPointerDown={tap}>
      <div class="end-confetti" ref={(el) => Object.assign(refs, { confetti: el })} aria-hidden="true" />
      <section class="end-info">
        <Sleeve outcome={props.outcome} picture={picture()} refs={refs} />
        <StarRow outcome={props.outcome} refs={refs} />
      </section>
      <Band plan={plan} refs={refs} />
      <div class="end-foot">
        <Show when={done()}>
          <DoneButton onDone={() => props.onDone()} />
        </Show>
      </div>
    </main>
  );
};
