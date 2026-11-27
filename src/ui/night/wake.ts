// The wake-up scene, 5 s (play-sessions spec, "Screens and motion"): the moon sets and the stars go (0.3 s), dawn
// (0.5 s), the sun rises behind the logo and wakes it (0.9 s to 2.5 s: the eyes open, the record turns), the blanket
// slides off and the pals stretch (2.2 s), the title look of the day comes back (2.3 s to 3.6 s), and the play button
// pops in (3.8 s). The types and the helpers are in ./motion.ts.

import { EASE, faceFade, faceOn, PALS, track, type Track } from './motion';
import { wakePal } from './wake-pals';
import type { SceneSound } from '../../sound';
import type { SunFace } from '../sun/Sun';

export const WAKE_SEC = 5;

/** The celesta goes up while the sun rises, and the yawn comes with the stretch. */
export const WAKE_SOUNDS: readonly SceneSound[] = [
  { effect: 'wake-up', at: 0.9 },
  { effect: 'yawn', at: 2.55 },
];

/** The play button pulses from this time (its CSS animation delay). */
export const PULSE_AT = 4.4;

export const WAKE_SUN_FACES: readonly SunFace[] = ['asleep', 'happy'];

/** The layout facts of the wake-up scene, which the stage measures. */
export type WakeLayout = {
  readonly reduce: boolean;
  /** The rest time was over before the scene: the first light shows already, and the moon is low. */
  readonly restTimeOver: boolean;
  /** The distance in px from the place of the sun behind the logo down to its place behind the hill. */
  readonly rise: number;
  /** Landscape: the distance in px from the brand in the middle to its column next to the play button. */
  readonly brandShift: number;
};

/** The night goes: the stars, the night sky, the first light, and the moon fade out, and the dawn comes and goes. */
const nightGoes = (restTimeOver: boolean): Track[] => [
  track('stars', 'opacity', [
    [0.4, '1', EASE.inOut],
    [1.6, '0'],
  ]),
  track('sky-dawn', 'opacity', [
    [0.5, '0', EASE.inOut],
    [2, '1'],
    [2.3, '1', EASE.inOut],
    [3.6, '0'],
  ]),
  track('sky-night', 'opacity', [
    [0.5, '1', EASE.inOut],
    [2, '0'],
  ]),
  track('first-light', 'opacity', [
    [0.5, restTimeOver ? '1' : '0', EASE.inOut],
    [2, '0'],
  ]),
  track('hill', 'opacity', [
    [2.3, '1', EASE.inOut],
    [3.6, '0'],
  ]),
  track('moon', 'opacity', [
    [0.3, '1', EASE.inOut],
    [1.8, '0'],
  ]),
];

/** The logo opens its eyes, the sun wakes, the blanket and the "Zzz" go, and the play button comes. */
const fades = (reduce: boolean): Track[] => {
  const fade = faceFade(reduce);
  return [
    faceOn('sun-face-asleep', ['start', 1.6], fade),
    faceOn('sun-face-happy', [1.6], fade),
    track('sun-rays', 'opacity', [
      [1.6, '0', EASE.out],
      [2.1, '1'],
    ]),
    faceOn('logo-asleep', ['start', 2.45], fade),
    faceOn('logo-awake', [2.45], fade),
    track('zzz', 'opacity', [
      [0.3, '1'],
      [0.8, '0'],
    ]),
    track('blanket', 'opacity', [
      [2.2, '1', EASE.in],
      [2.7, '0'],
    ]),
    track('play', 'opacity', [
      [3.8, '0', EASE.out],
      [4.2, '1'],
    ]),
  ];
};

/** Reduced motion: the sun fades in behind the logo and out again. In landscape, the brand fades out in the middle
 * and fades in at its column. */
const reducedMoves = ({ brandShift }: WakeLayout): Track[] => [
  track('sun', 'opacity', [
    [0.9, '0'],
    [1.6, '1'],
    [2.3, '1'],
    [2.9, '0'],
  ]),
  ...(brandShift === 0
    ? []
    : [
        track('brand', 'opacity', [
          [3.5, '1'],
          [3.8, '0'],
          [3.8001, '0'],
          [4.1, '1'],
        ]),
        track('brand', 'translate', [
          [3.8, `${String(brandShift)}px 0px`, 'step-end'],
          [3.8001, '0px 0px'],
        ]),
      ]),
];

/** The motion: the moon sets, the sun rises and fades, the logo label pops, the blanket slides off, the play button
 * pops in, and in landscape the brand moves to its column. */
const moves = ({ rise, brandShift }: WakeLayout): Track[] => [
  track('moon', 'translate', [
    [0.3, '0px 0px', EASE.in],
    [1.8, '0px 140px'],
  ]),
  track('sun-rise', 'translate', [
    [0.9, `0px ${String(rise)}px`, EASE.out],
    [2.5, '0px 0px'],
  ]),
  track('sun-rays', 'scale', [
    [1.6, '0.7', EASE.out],
    [2.4, '1'],
  ]),
  track('sun', 'opacity', [
    [2.5, '1'],
    [2.9, '0'],
  ]),
  track('logo-label', 'scale', [
    [2.4, '1', EASE.out],
    [2.55, '1.08', EASE.out],
    [2.9, '1'],
  ]),
  track('blanket', 'translate', [
    [2.2, '-50% 0px', EASE.in],
    [2.7, '-50% 50px'],
  ]),
  {
    ...track('logo-disc', 'rotate', [
      [2.5, '0deg'],
      [10.5, '360deg'],
    ]),
    loop: true,
  },
  track('play', 'scale', [
    [3.8, '0.6', EASE.out],
    [4.3, '1'],
  ]),
  ...(brandShift === 0
    ? []
    : [
        track('brand', 'translate', [
          [3.6, `${String(brandShift)}px 0px`, EASE.out],
          [4.2, '0px 0px'],
        ]),
      ]),
];

export const wakePlan = (layout: WakeLayout): Track[] => [
  ...nightGoes(layout.restTimeOver),
  ...fades(layout.reduce),
  ...(layout.reduce ? reducedMoves(layout) : moves(layout)),
  ...PALS.flatMap((pal) => wakePal(pal, layout.reduce)),
];
