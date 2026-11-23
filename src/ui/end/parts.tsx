import { For, Show } from 'solid-js';
import { RECORD_COLORS } from '../../model';
import { palPicture } from '../pals/pal-svg';
import { Record, StarIcon } from '../songs/record';
import { SongPicture } from '../songs/SongList';
import type { Lane, PlayOutcome } from '../../model';
import type { ScenePlan } from './motion';
import type { JSX } from 'solid-js';

// The parts of the end scene that the motion moves. Each part puts its elements into the refs of the scene.

/** The elements of the scene, filled by the refs. */
export type Refs = {
  root?: HTMLElement;
  cover?: HTMLElement;
  record?: HTMLElement;
  newRecord?: HTMLElement;
  starSparks?: HTMLElement;
  landSparks?: HTMLElement;
  confetti?: HTMLElement;
  stars: HTMLElement[];
  bodies: HTMLElement[];
  pals: HTMLElement[];
};

const LANES: readonly Lane[] = [0, 1, 2];
const SPARKS = 8;

/** 8 sparkles that the motion opens out around their place. */
const Sparks = (props: { readonly ref: (el: HTMLElement) => void }): JSX.Element => (
  <span class="end-sparks" ref={(el) => props.ref(el)} aria-hidden="true">
    <For each={Array.from({ length: SPARKS })}>{() => <StarIcon on class="end-spark" />}</For>
  </span>
);

type SleeveProps = { readonly outcome: PlayOutcome; readonly picture: string | undefined; readonly refs: Refs };

/** The song picture in front, with the record of the play (and the record of a new color) behind it. */
export const Sleeve = (props: SleeveProps): JSX.Element => (
  <div class="end-sleeve">
    <Show when={props.outcome.opened}>
      {(opened) => (
        <div class="end-record" ref={(el) => Object.assign(props.refs, { newRecord: el })}>
          <Record color={opened()} />
        </div>
      )}
    </Show>
    <div class="end-record" ref={(el) => Object.assign(props.refs, { record: el })}>
      <Record color={RECORD_COLORS[props.outcome.before.color]} />
    </div>
    <div class="end-cover" ref={(el) => Object.assign(props.refs, { cover: el })}>
      <SongPicture picture={props.picture} />
    </div>
  </div>
);

/** The 3 star places of the record. The stars of before the play shine; the new star flies in. */
export const StarRow = (props: { readonly outcome: PlayOutcome; readonly refs: Refs }): JSX.Element => (
  <div class="end-stars" role="img" aria-label={`${String(props.outcome.after.stars)} stars`}>
    <For each={[0, 1, 2]}>
      {(place) => (
        <span class="end-slot">
          <StarIcon on={false} />
          <span
            class="end-star"
            classList={{ earned: place < props.outcome.before.stars || place === props.outcome.star }}
            ref={(el) => props.refs.stars.push(el)}
          >
            <StarIcon on />
          </span>
          <Show when={place === props.outcome.star}>
            <Sparks ref={(el) => Object.assign(props.refs, { starSparks: el })} />
          </Show>
        </span>
      )}
    </For>
  </div>
);

/** The 3 pals on the floor, Pip, Dot, and Bo in their places. A waiting pal stands a little smaller. The dancers
 * smile; a waiting pal that does not dance looks on. There is never a sad pal. */
export const Band = (props: { readonly plan: ScenePlan; readonly refs: Refs }): JSX.Element => {
  const dances = (lane: Lane): boolean => props.plan.dance !== 'band' || props.plan.band.includes(lane);
  return (
    <section class="end-stage">
      <For each={LANES}>
        {(lane) => (
          <span class="end-spot" classList={{ waiting: !props.plan.band.includes(lane) }}>
            <span class="end-shadow" />
            <span class="end-body" ref={(el) => props.refs.bodies.push(el)}>
              <img
                class="end-pal"
                src={palPicture(lane, dances(lane) ? 'happy' : 'idle')}
                alt=""
                draggable={false}
                ref={(el) => props.refs.pals.push(el)}
              />
            </span>
            <Show when={lane === props.plan.joins}>
              <Sparks ref={(el) => Object.assign(props.refs, { landSparks: el })} />
            </Show>
          </span>
        )}
      </For>
    </section>
  );
};
