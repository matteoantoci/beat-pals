import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { bandOf, danceOf, RECORD_COLORS } from '../../model';
import { reducedMotion, watchReducedMotion } from '../play/reduced-motion';
import { pictureOf, type SongChoice } from '../songs/SongList';
import { playScene, sceneLength, type ScenePlan, type SceneParts } from './motion';
import { Band, Sleeve, StarRow, type Refs } from './parts';
import type { PlayScore } from '../../model';
import type { JSX } from 'solid-js';

// The end scene (spec, "Screens"): the result of the play in pictures, with no numbers. The record of the play
// slides out of the song sleeve, a new star flies to its place, a new record color slides out after a third star,
// and at silver and gold the new pal jumps into the band (the join scene). The pals dance by the hit ratio. Then
// one button goes back to the song list.
// Taps: each `pointerdown` in the first 2 s does nothing, and a pointer that went down before the scene never
// gives a `pointerdown` here. After that, one tap skips to the final state. The button reacts only to a pointer
// that went down on the button itself, so the skip tap never presses it, also when iOS sends its click to the
// button that shows under the finger.

/** The first 2 s of the scene ignore each tap. */
const DEAF_MS = 2000;

type EndSceneProps = {
  readonly choice: SongChoice;
  /** The hit ratio of the play. */
  readonly ratio: number;
  readonly score: PlayScore;
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
    star: props.score.star,
    opened: props.score.opened !== null,
    joins: props.score.joins,
    dance: danceOf(props.ratio),
    band: bandOf(RECORD_COLORS[props.score.before.color]),
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
  onMount(() => {
    pictureOf(props.choice.key, props.choice.song).then(setPicture, ignore);
    onCleanup(() => URL.revokeObjectURL(picture() ?? ''));
    const parts = sceneParts(refs);
    skip = parts === undefined ? ignore : playScene(parts, plan, reducedMotion());
    // A change to reduced motion during the scene stops each motion: the parts jump to their final state.
    onCleanup(watchReducedMotion((reduced) => reduced && skip()));
    const timer = setTimeout(finish, sceneLength(plan) * 1000);
    onCleanup(() => clearTimeout(timer));
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
        <Sleeve score={props.score} picture={picture()} refs={refs} />
        <StarRow score={props.score} refs={refs} />
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
