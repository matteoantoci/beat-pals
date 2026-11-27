// The pals of the wake-up scene (./wake.ts): the blanket slides off, and they stretch, yawn, and smile. The types
// and the helpers are in ./motion.ts.

import {
  ARMS,
  deg,
  EASE,
  faceFade,
  faceSeq,
  LEAN,
  onPal,
  scale,
  SLEEP_DROP,
  SLEEP_POSE,
  track,
  WAKE_STRETCH,
  type Track,
} from './motion';
import type { PalFace, PalIndex } from '../pals/pal-svg';

/** The order of the faces in the stacks, bottom first. */
export const WAKE_FACES: readonly PalFace[] = ['sleep', 'yawn', 'happy', 'idle'];

/** The stretch of a body out of the sleep pose. */
const stretch = (pal: PalIndex, d: number): Track[] => [
  track('body', 'scale', [
    [2.4 + d, scale(SLEEP_POSE), EASE.out],
    [2.9 + d, scale(WAKE_STRETCH), EASE.inOut],
    [3.3 + d, scale(WAKE_STRETCH), EASE.out],
    [3.7 + d, '1 1'],
  ]),
  track('body', 'translate', [
    [2.4 + d, SLEEP_DROP, EASE.out],
    [2.9 + d, '0px -6px', EASE.inOut],
    [3.3 + d, '0px -6px', EASE.out],
    [3.7 + d, '0px 0px'],
  ]),
  track('body', 'rotate', [
    [2.4 + d, LEAN[pal], EASE.out],
    [2.9 + d, '0deg'],
  ]),
  ...ARMS.flatMap(({ part, side }) => [
    track(part, 'rotate', [
      [2.6 + d, deg(side, 120), EASE.out],
      [3 + d, deg(side, 14), EASE.sine],
      [3.35 + d, deg(side, 22), EASE.in],
      [3.7 + d, deg(side, 120)],
    ]),
    track(part, 'opacity', [
      [2.6 + d, '0'],
      [2.7 + d, '1'],
      [3.6 + d, '1'],
      [3.7 + d, '0'],
    ]),
  ]),
];

/** The pals wake: they stretch, yawn, and smile, each pal 0.15 s after the one before it. With reduced motion, only
 * the faces change. */
export const wakePal = (pal: PalIndex, reduce: boolean): Track[] => {
  const d = pal * 0.15;
  const faces = faceSeq(
    WAKE_FACES,
    [
      ['sleep', 0],
      ['yawn', 2.6 + d],
      ['happy', 3.4 + d],
      ['idle', 4.1 + d],
    ],
    faceFade(reduce)
  );
  return onPal(pal)(reduce ? faces : [...faces, ...stretch(pal, d)]);
};
