import { For } from 'solid-js';
import { BEADS } from './beads';
import { HoldButton } from './HoldButton';
import type { PlayElements } from './fit';
import type { JSX } from '@solidjs/web';

// The layers of the play screen that the demo route shows too (spec, "Screens"): the PixiJS canvas, Pip, Dot, and Bo
// as HTML pictures above it, the probe of the safe areas, and the HUD with the pause button and the progress beads of
// the song. The screen puts them in its root element, and the refs keep the elements for the play lifetime.

/** The elements of the play screen: the markup gives each element to its ref while it renders. */
export type PlayRefs = {
  readonly root: (el: HTMLElement) => void;
  readonly canvas: (el: HTMLCanvasElement) => void;
  readonly probe: (el: HTMLElement) => void;
  readonly pal: (el: HTMLImageElement) => void;
  readonly bead: (el: HTMLElement) => void;
  /** The elements of the play, or undefined before the markup rendered. */
  readonly elements: () => PlayElements | undefined;
};

export const playRefs = (): PlayRefs => {
  let root: HTMLElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let probe: HTMLElement | undefined;
  const pals: HTMLImageElement[] = [];
  const beads: HTMLElement[] = [];
  return {
    root: (el) => {
      root = el;
    },
    canvas: (el) => {
      canvas = el;
    },
    probe: (el) => {
      probe = el;
    },
    pal: (el) => pals.push(el),
    bead: (el) => beads.push(el),
    elements: () =>
      root === undefined || canvas === undefined || probe === undefined
        ? undefined
        : { root, canvas, probe, pals, beads },
  };
};

/** The pause button (a hold of 0.6 s) and the progress beads of the song, with no numbers. */
const Hud = (props: { readonly onPause: () => void; readonly bead: (el: HTMLElement) => void }): JSX.Element => (
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

export const PlayLayers = (props: { readonly refs: PlayRefs; readonly onPause: () => void }): JSX.Element => (
  <>
    <canvas class="play-stage" ref={(el) => props.refs.canvas(el)} />
    <For each={[0, 1, 2]}>
      {() => <img class="play-pal" alt="" hidden draggable="false" ref={(el) => props.refs.pal(el)} />}
    </For>
    <div class="play-probe" ref={(el) => props.refs.probe(el)} />
    <Hud onPause={() => props.onPause()} bead={(el) => props.refs.bead(el)} />
  </>
);
