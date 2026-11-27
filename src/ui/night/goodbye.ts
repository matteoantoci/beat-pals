// The goodbye scene, 7.6 s (play-sessions spec, "Screens and motion"): the wave (0.3 s), the bow (2.6 s), the sun
// yawns and sets (2.9 s), night falls and the moon rises (3.2 s), one yawn (4.6 s), the pals sit and sleep (5.45 s),
// the blanket (5.7 s), and the logo and the wordmark come back at night (6.2 s). The types and the helpers are in
// ./motion.ts.

import { goodbyePal } from './goodbye-pals';
import { EASE, faceFade, faceOn, PALS, track, type Track } from './motion';
import type { SceneSound } from '../../sound';
import type { SunFace } from '../sun/Sun';

export const GOODBYE_SEC = 7.6;

/** The goodbye tune starts on the bow. Its chord at 5.34 s rings out as the pals fall asleep (./goodbye-pals.ts). No
 * yawn sound: the end scene just before had one. */
export const GOODBYE_SOUNDS: readonly SceneSound[] = [{ effect: 'goodbye', at: 2.6 }];

export const GOODBYE_SUN_FACES: readonly SunFace[] = ['droopy', 'yawn', 'asleep'];

/** The sun of the sunset stage, and its red when it goes behind the hill. */
const SUNSET_SUN = 'oklch(0.8 0.16 54)';
const LOW_SUN = 'oklch(0.7 0.16 40)';
/** The hill in the light of the sunset, and at night. */
const SUNSET_HILL = 'oklch(0.3 0.13 290)';
const NIGHT_HILL = 'oklch(0.17 0.07 280)';

/** The sun: it yawns, goes red, and sets behind the hill. With reduced motion, it fades out. */
const sunset = (reduce: boolean): Track[] => {
  const fade = faceFade(reduce);
  return [
    faceOn('sun-face-droopy', ['start', 3.4], fade),
    faceOn('sun-face-yawn', [3.4, 4.1], fade),
    faceOn('sun-face-asleep', [4.1], fade),
    track('sun', '--sunc', [
      [2.9, SUNSET_SUN, EASE.inOut],
      [5, LOW_SUN],
    ]),
    ...(reduce
      ? [
          track('sun', 'opacity', [
            [3.6, '1'],
            [5, '0'],
          ]),
        ]
      : [
          track('sun-rise', 'translate', [
            [2.9, '0px 0px', EASE.set],
            [5.2, '0px 190px'],
          ]),
          track('sun', 'opacity', [
            [4.6, '1'],
            [5.4, '0'],
          ]),
        ]),
  ];
};

/** The night falls: the sky, the stars, the hill, the moon, the blanket, the brand, and the "Zzz". The moon, the
 * blanket, and the brand also move up, except with reduced motion. */
const nightfall = (reduce: boolean): Track[] => [
  track('sky-sunset', 'opacity', [
    [3.2, '1', EASE.inOut],
    [5.4, '0'],
  ]),
  track('sky-night', 'opacity', [
    [2.8, '0', EASE.inOut],
    [4.2, '1'],
  ]),
  track('stars', 'opacity', [
    [4.4, '0', EASE.inOut],
    [5.8, '1'],
  ]),
  track('hill', 'background-color', [
    [3.2, SUNSET_HILL, EASE.inOut],
    [5.4, NIGHT_HILL],
  ]),
  track('moon', 'opacity', [
    [3.8, '0', EASE.out],
    [5, '1'],
  ]),
  track('blanket', 'opacity', [
    [5.7, '0', EASE.out],
    [6.1, '1'],
  ]),
  track('brand', 'opacity', [
    [6.2, '0', EASE.out],
    [7.2, '1'],
  ]),
  track('zzz', 'opacity', [
    [6.8, '0'],
    [7.3, '1'],
  ]),
  ...(reduce
    ? []
    : [
        track('moon', 'translate', [
          [3.8, '0px 120px', EASE.out],
          [5.8, '0px 0px'],
        ]),
        track('blanket', 'translate', [
          [5.7, '-50% 50px', EASE.out],
          [6.4, '-50% 0px'],
        ]),
        track('brand', 'translate', [
          [6.2, '0px 12px', EASE.out],
          [7.2, '0px 0px'],
        ]),
      ]),
];

export const goodbyePlan = (reduce: boolean): Track[] => [
  ...nightfall(reduce),
  ...sunset(reduce),
  ...PALS.flatMap((pal) => goodbyePal(pal, reduce)),
];
