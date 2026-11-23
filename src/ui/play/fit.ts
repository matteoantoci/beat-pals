// The fit of the play to the screen: the elements of the play screen, the geometry from their size and the safe
// areas, and the new layout after a turn of the device.

import { layout, type Geometry } from './geometry';
import type { Pals } from './pals';
import type { Stage } from './stage';

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
export const measure = ({ root, probe }: Pick<PlayElements, 'root' | 'probe'>): Geometry => {
  const style = getComputedStyle(probe);
  return layout(root.clientWidth, root.clientHeight, {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  });
};

/**
 * A turn of the device paints the stage again for the new size and places the pals again. `redraw` draws a frame
 * after that, for a screen with no frame loop (the demo route).
 */
export const watchResize = (
  elements: Pick<PlayElements, 'root' | 'probe'>,
  { stage, pals }: { readonly stage: Stage; readonly pals: Pals },
  redraw: () => void = () => undefined
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
