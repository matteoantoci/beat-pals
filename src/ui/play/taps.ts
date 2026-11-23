// The taps of the play screen (spec, "Play rules"). A hit is judged on `pointerdown`, in the column of the pointer
// over the full height of the screen. A pointer that goes down on the pause button (or on the pause screen) is not
// judged and never makes a pal hop. A release goes to the model on `pointerup`, `pointercancel`, and a lost pointer
// capture, so a soft hold never stays down.

import { laneAt, type Geometry } from './geometry';
import type { Lane } from '../../model';

export type TapHooks = {
  /** The geometry of now, or undefined before the first layout. */
  readonly geometry: () => Geometry | undefined;
  readonly press: (lane: Lane, pointerId: number) => void;
  readonly release: (pointerId: number) => void;
};

/** The parts of the play screen whose pointers are not taps in a lane. */
const NOT_A_LANE = '.pause-button, .pause-screen';

/** Listens to the taps on the play screen. Gives the function that stops the listening. */
export const watchTaps = (root: HTMLElement, hooks: TapHooks): (() => void) => {
  const down = (event: PointerEvent): void => {
    const geometry = hooks.geometry();
    if (geometry === undefined || (event.target instanceof Element && event.target.closest(NOT_A_LANE) !== null)) {
      return;
    }
    // The capture keeps the up event of the pointer here, also when the finger slides off the screen.
    root.setPointerCapture(event.pointerId);
    hooks.press(laneAt(geometry, event.clientX), event.pointerId);
  };
  const up = (event: PointerEvent): void => hooks.release(event.pointerId);
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('lostpointercapture', up);
  return () => {
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', up);
    root.removeEventListener('lostpointercapture', up);
  };
};
