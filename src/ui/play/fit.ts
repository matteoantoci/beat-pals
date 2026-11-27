// The fit of the play to the screen: the elements of the play screen, the geometry from their size and the safe
// areas, and the new layout after a turn of the device. The stage ports make the stage and the pals on these
// elements for the play lifetime (play-load.ts).

import { decodePals } from '../pals/pal-svg';
import { layout, type Geometry } from './geometry';
import { makePals, type Pals } from './pals';
import { createStage, type Stage } from './stage';
import type { StagePorts } from './load-parts';

export type PlayElements = {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  /** An element with the safe-area insets as its padding. */
  readonly probe: HTMLElement;
  /** Pip, Dot, and Bo. */
  readonly pals: readonly HTMLImageElement[];
  readonly beads: readonly HTMLElement[];
};

const px = (value: string): number => Number.parseFloat(value) || 0;

/** The safe-area insets come from the padding of the probe, which CSS sets to env(safe-area-inset-*). */
const measure = ({ root, probe }: Pick<PlayElements, 'root' | 'probe'>): Geometry => {
  const style = getComputedStyle(probe);
  return layout(root.clientWidth, root.clientHeight, {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  });
};

/** A turn of the device paints the stage again for the new size, places the pals again, and calls `redraw`. */
const watchResize = (
  elements: Pick<PlayElements, 'root' | 'probe'>,
  { stage, pals }: { readonly stage: Stage; readonly pals: Pals },
  redraw: () => void
): { geometry: () => Geometry; unresize: () => void } => {
  let geometry = measure(elements);
  pals.layout(geometry);
  const onResize = (): void => {
    geometry = measure(elements);
    stage.resize(geometry);
    pals.layout(geometry);
    redraw();
  };
  window.addEventListener('resize', onResize);
  return { geometry: () => geometry, unresize: () => window.removeEventListener('resize', onResize) };
};

/** The stage steps on the elements of the play screen. `redraw` draws a frame after a turn of the device, for a
 * screen with no frame loop (the demo route). */
export const stagePorts = (elements: PlayElements, redraw: () => void = () => undefined): StagePorts => ({
  pictures: decodePals,
  stage: (band) => createStage(elements.canvas, measure(elements), band),
  arrange: (stage, band, beats) => {
    const pals = makePals(elements.pals, band, beats);
    return { pals, ...watchResize(elements, { stage, pals }, redraw) };
  },
});
