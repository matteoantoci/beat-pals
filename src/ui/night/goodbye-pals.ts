// The pals of the goodbye scene (./goodbye.ts): they wave, bow, yawn once, and sit down to sleep. The types and the
// helpers are in ./motion.ts, src/ui/motion/keys.ts, and src/ui/pals/session-pal-motion.ts.

import { deg, EASE, faceChangeSec, keysIn, scale } from '../motion/keys';
import { ARM_SIDES, armWaveKeys, waveEnd, type ArmSide } from '../pals/session-pal-motion';
import {
  BOW,
  breath,
  curve,
  faceCurves,
  GOODBYE_YAWN,
  LEAN,
  onPal,
  SLEEP_DROP,
  SLEEP_POSE,
  type Curve,
} from './motion';
import type { PalFace, PalIndex } from '../pals/pal-svg';

/** The order of the faces in the stacks, bottom first. */
export const GOODBYE_FACES: readonly PalFace[] = ['happy', 'yawn', 'sleep'];

/** The first pal falls asleep at this time; each next pal 0.12 s later. */
const FALL_ASLEEP_AT = 5.45;

const WAVES = 3;

/** A wave: the arm comes out from behind, goes back and forth 3 times (0.3 s each way), and then goes back behind
 * the pal. */
const wave = ({ part, side }: ArmSide, at: number): Curve[] => {
  const end = waveEnd(at, WAVES);
  return [
    curve(
      part,
      'rotate',
      keysIn([...armWaveKeys(at, WAVES), [end + 0.3, 40, EASE.in], [end + 0.65, 115]], (angle) => deg(side, angle))
    ),
    curve(part, 'opacity', [
      [at, '0'],
      [at + 0.12, '1'],
      [end + 0.5, '1'],
      [end + 0.65, '0'],
    ]),
  ];
};

/** The bow, the yawn, and the sleep pose of a body. */
const bowAndSleep = (pal: PalIndex): Curve[] => {
  const d = pal * 0.12;
  const asleep = FALL_ASLEEP_AT + d;
  return [
    curve('body', 'scale', [
      [2.6 + d, '1 1', EASE.out],
      [2.9 + d, scale(BOW), EASE.inOut],
      [3.4 + d, '1 1'],
      [4.7 + d, '1 1', EASE.out],
      [5, scale(GOODBYE_YAWN), EASE.inOut],
      [asleep, scale(GOODBYE_YAWN), EASE.inOut],
      [asleep + 0.45, scale(SLEEP_POSE)],
    ]),
    curve('body', 'translate', [
      [2.6 + d, '0px 0px', EASE.out],
      [2.9 + d, '0px 3px', EASE.inOut],
      [3.4 + d, '0px 0px'],
      [asleep, '0px 0px', EASE.inOut],
      [asleep + 0.45, SLEEP_DROP],
    ]),
    curve('body', 'rotate', [
      [asleep, '0deg', EASE.inOut],
      [asleep + 0.45, LEAN[pal]],
    ]),
  ];
};

/** The pals of the goodbye: they wave, bow, yawn once, and sit down to sleep, each pal 0.12 s after the one before
 * it. Only the outer arm of the 2 side pals waves, because they stand behind the pal in the middle. With reduced
 * motion, the raised arms fade in and out, and only the faces change. */
export const goodbyePal = (pal: PalIndex, reduce: boolean): Curve[] => {
  const d = pal * 0.12;
  const arms = ARM_SIDES.filter(({ arm }) => pal === 1 || arm === (pal === 0 ? 'left' : 'right'));
  const faces = faceCurves(
    [
      ['face-happy', 0],
      ['face-yawn', 4.6 + d],
      ['face-sleep', FALL_ASLEEP_AT + d],
    ],
    faceChangeSec(reduce),
    true
  );
  const motion = reduce
    ? arms.flatMap(({ part, side }) => [
        curve(part, 'rotate', [[0, deg(side, 45)]]),
        curve(part, 'opacity', [
          [0.3, '0'],
          [0.6, '1'],
          [2.3, '1'],
          [2.6, '0'],
        ]),
      ])
    : [...arms.flatMap((arm) => wave(arm, 0.3 + d)), ...bowAndSleep(pal)];
  return [...onPal(pal)([...faces, ...motion]), ...(reduce ? [] : [breath(pal, 6.4)])];
};
