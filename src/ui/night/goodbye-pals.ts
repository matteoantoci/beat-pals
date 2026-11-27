// The pals of the goodbye scene (./goodbye.ts): they wave, bow, yawn once, and sit down to sleep. The types and the
// helpers are in ./motion.ts.

import {
  ARMS,
  BOW,
  breath,
  deg,
  EASE,
  faceFade,
  faceSeq,
  GOODBYE_YAWN,
  LEAN,
  onPal,
  scale,
  SLEEP_DROP,
  SLEEP_POSE,
  track,
  type Arm,
  type Key,
  type Track,
} from './motion';
import type { PalFace, PalIndex } from '../pals/pal-svg';

/** The order of the faces in the stacks, bottom first. */
export const GOODBYE_FACES: readonly PalFace[] = ['happy', 'yawn', 'sleep'];

/** The first pal falls asleep at this time; each next pal 0.12 s later. */
const FALL_ASLEEP_AT = 5.45;

/** A wave: the arm comes out from behind, goes back and forth 3 times (0.3 s each way), and then goes back behind
 * the pal. */
const wave = ({ part, side }: Arm, at: number): Track[] => {
  const swings = [1, 2, 3].flatMap((time): Key[] => [
    [at + 0.25 + (time * 2 - 1) * 0.3, deg(side, 70), EASE.sine],
    [at + 0.25 + time * 2 * 0.3, deg(side, 32), EASE.sine],
  ]);
  const end = at + 0.25 + 1.8;
  return [
    track(part, 'rotate', [
      [at, deg(side, 110), EASE.out],
      [at + 0.25, deg(side, 32), EASE.sine],
      ...swings,
      [end + 0.3, deg(side, 40), EASE.in],
      [end + 0.65, deg(side, 115)],
    ]),
    track(part, 'opacity', [
      [at, '0'],
      [at + 0.12, '1'],
      [end + 0.5, '1'],
      [end + 0.65, '0'],
    ]),
  ];
};

/** The bow, the yawn, and the sleep pose of a body. */
const bowAndSleep = (pal: PalIndex): Track[] => {
  const d = pal * 0.12;
  const asleep = FALL_ASLEEP_AT + d;
  return [
    track('body', 'scale', [
      [2.6 + d, '1 1', EASE.out],
      [2.9 + d, scale(BOW), EASE.inOut],
      [3.4 + d, '1 1'],
      [4.7 + d, '1 1', EASE.out],
      [5, scale(GOODBYE_YAWN), EASE.inOut],
      [asleep, scale(GOODBYE_YAWN), EASE.inOut],
      [asleep + 0.45, scale(SLEEP_POSE)],
    ]),
    track('body', 'translate', [
      [2.6 + d, '0px 0px', EASE.out],
      [2.9 + d, '0px 3px', EASE.inOut],
      [3.4 + d, '0px 0px'],
      [asleep, '0px 0px', EASE.inOut],
      [asleep + 0.45, SLEEP_DROP],
    ]),
    track('body', 'rotate', [
      [asleep, '0deg', EASE.inOut],
      [asleep + 0.45, LEAN[pal]],
    ]),
  ];
};

/** The pals of the goodbye: they wave, bow, yawn once, and sit down to sleep, each pal 0.12 s after the one before
 * it. Only the outer arm of the 2 side pals waves, because they stand behind the pal in the middle. With reduced
 * motion, the raised arms fade in and out, and only the faces change. */
export const goodbyePal = (pal: PalIndex, reduce: boolean): Track[] => {
  const d = pal * 0.12;
  const arms = ARMS.filter(({ part }) => pal === 1 || part === (pal === 0 ? 'arm-left' : 'arm-right'));
  const faces = faceSeq(
    GOODBYE_FACES,
    [
      ['happy', 0],
      ['yawn', 4.6 + d],
      ['sleep', FALL_ASLEEP_AT + d],
    ],
    faceFade(reduce)
  );
  const motion = reduce
    ? arms.flatMap(({ part, side }) => [
        track(part, 'rotate', [[0, deg(side, 45)]]),
        track(part, 'opacity', [
          [0.3, '0'],
          [0.6, '1'],
          [2.3, '1'],
          [2.6, '0'],
        ]),
      ])
    : [...arms.flatMap((arm) => wave(arm, 0.3 + d)), ...bowAndSleep(pal)];
  return [...onPal(pal)([...faces, ...motion]), ...(reduce ? [] : [breath(pal, 6.4)])];
};
