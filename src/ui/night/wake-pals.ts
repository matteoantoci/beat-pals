// The pals of the wake-up scene (./wake.ts): the blanket slides off, and they stretch, yawn, and smile. The types
// and the helpers are in ./motion.ts, src/ui/motion/keys.ts, and src/ui/pals/session-pal-motion.ts.

import { deg, EASE, faceChangeSec, keysIn, scale } from '../motion/keys';
import { ARM_SIDES, stretchKeys, stretchShowKeys } from '../pals/session-pal-motion';
import { curve, faceCurves, LEAN, onPal, SLEEP_DROP, SLEEP_POSE, WAKE_STRETCH, type Curve } from './motion';
import type { PalFace, PalIndex } from '../pals/pal-svg';

/** The order of the faces in the stacks, bottom first. */
export const WAKE_FACES: readonly PalFace[] = ['sleep', 'yawn', 'happy', 'idle'];

/** The stretch of a body out of the sleep pose. */
const stretch = (pal: PalIndex, d: number): Curve[] => [
  curve('body', 'scale', [
    [2.4 + d, scale(SLEEP_POSE), EASE.out],
    [2.9 + d, scale(WAKE_STRETCH), EASE.inOut],
    [3.3 + d, scale(WAKE_STRETCH), EASE.out],
    [3.7 + d, '1 1'],
  ]),
  curve('body', 'translate', [
    [2.4 + d, SLEEP_DROP, EASE.out],
    [2.9 + d, '0px -6px', EASE.inOut],
    [3.3 + d, '0px -6px', EASE.out],
    [3.7 + d, '0px 0px'],
  ]),
  curve('body', 'rotate', [
    [2.4 + d, LEAN[pal], EASE.out],
    [2.9 + d, '0deg'],
  ]),
  ...ARM_SIDES.flatMap(({ part, side }) => [
    curve(
      part,
      'rotate',
      keysIn(stretchKeys({ at: 2.6 + d, end: 3.7 + d, open: [0.4, 14], close: [0.35, 22] }), (angle) =>
        deg(side, angle)
      )
    ),
    curve(part, 'opacity', stretchShowKeys(2.6 + d, 3.7 + d)),
  ]),
];

/** The pals wake: they stretch, yawn, and smile, each pal 0.15 s after the one before it. With reduced motion, only
 * the faces change. */
export const wakePal = (pal: PalIndex, reduce: boolean): Curve[] => {
  const d = pal * 0.15;
  const faces = faceCurves(
    [
      ['face-sleep', 0],
      ['face-yawn', 2.6 + d],
      ['face-happy', 3.4 + d],
      ['face-idle', 4.1 + d],
    ],
    faceChangeSec(reduce),
    true
  );
  return onPal(pal)(reduce ? faces : [...faces, ...stretch(pal, d)]);
};
