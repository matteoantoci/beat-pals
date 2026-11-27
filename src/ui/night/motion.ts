// The motion of the session end and start (play-sessions spec, "Screens and motion"), as in the sunset prototype:
// the goodbye scene (./goodbye.ts), the night title (here), and the wake-up scene (./wake.ts). Each scene is a list
// of curves on the scene clock in seconds: one curve for each part and property, with its keys. ./timeline.ts plays
// a list on the parts of ./NightStage.tsx. The lists are data, so the tests check the squash and stretch and the
// scale of the sun and the moon on them. The keys, the easings, and the face changes are in src/ui/motion/keys.ts.
// Reduced motion: every timed motion becomes a fade, the faces cross-fade, and the loops stop.

import { EASE, faceStackKeys, scale, type Key, type Squash } from '../motion/keys';
import type { PalFace, PalIndex } from '../pals/pal-svg';
import type { SunFace } from '../sun/Sun';

/** A part of the stage. A part of a pal (body, stack, arms, faces) also has the index of the pal. */
type Part =
  | 'sky-sunset'
  | 'sky-night'
  | 'sky-dawn'
  | 'first-light'
  | 'stars'
  | 'hill'
  | 'sun'
  | 'sun-rise'
  | 'sun-rays'
  | `sun-face-${SunFace}`
  | 'moon'
  | 'brand'
  | 'logo-disc'
  | 'logo-label'
  | 'logo-awake'
  | 'logo-asleep'
  | 'blanket'
  | 'zzz'
  | 'play'
  | 'body'
  | 'stack'
  | 'arm-left'
  | 'arm-right'
  | `face-${PalFace}`;

/** The motion of one property of one part on the scene clock. */
export type Curve = {
  readonly part: Part;
  readonly pal?: PalIndex;
  /** A CSS property: `opacity`, `scale`, `translate`, `rotate`, `background-color`, or `--sunc`. */
  readonly prop: string;
  readonly keys: readonly Key[];
  /** The curve plays again and again. */
  readonly loop?: boolean;
};

/** The squash and stretch of the pals: at most 6% from 1.0 on each axis, also a pose and its loop together. */
export const BOW: Squash = [1.04, 0.94];
export const GOODBYE_YAWN: Squash = [0.97, 1.05];
export const SLEEP_POSE: Squash = [1.04, 0.94];
/** The slow breath of a pal that sleeps, on the stack of faces, on top of the sleep pose. */
export const BREATH: Squash = [1.01, 1.03];
export const WAKE_STRETCH: Squash = [0.95, 1.06];

export const PALS: readonly PalIndex[] = [0, 1, 2];
/** The pals lean together in their sleep. */
export const LEAN = ['8deg', '0deg', '-8deg'] as const;
/** The pals that sleep sit a little lower. */
export const SLEEP_DROP = '0px 3px';

export const curve = (part: Part, prop: string, keys: readonly Key[]): Curve => ({ part, prop, keys });

/** The curves of one pal. The pal curves that loop (the breath) get their pal at once. */
export const onPal =
  (pal: PalIndex) =>
  (curves: readonly Curve[]): Curve[] =>
    curves.map(({ part, prop, keys }) => ({ part, prop, keys, pal }));

/** The faces of a stack in turn: each face part and the time when it shows, bottom first. With `over`, a face
 * covers the face below it (the pals); else the 2 faces cross-fade (the sun and the logo). */
export const faceCurves = (seq: readonly (readonly [Part, number])[], fade: number, over: boolean): Curve[] => {
  const keys = faceStackKeys(
    seq.map(([, at]) => at),
    fade,
    over
  );
  return seq.map(([part], k) => curve(part, 'opacity', keys[k] ?? []));
};

/** The slow breath of a pal that sleeps, from `at`: 2 s in, 2 s out, each pal 0.7 s after the one before it. */
export const breath = (pal: PalIndex, at: number): Curve => {
  const from = at + pal * 0.7;
  const keys: Key[] = [
    [from, '1 1', EASE.sine],
    [from + 2, scale(BREATH), EASE.sine],
    [from + 4, '1 1'],
  ];
  return { part: 'stack', pal, prop: 'scale', keys, loop: true };
};

/** The sleep pose of a pal from the start: low, with a lean to the pal in the middle. */
const sleepPose = (pal: PalIndex): Curve[] =>
  onPal(pal)([
    curve('body', 'scale', [[0, scale(SLEEP_POSE)]]),
    curve('body', 'translate', [[0, SLEEP_DROP]]),
    curve('body', 'rotate', [[0, LEAN[pal]]]),
  ]);

/** The night title: the pals sleep in their pose and breathe slowly. With reduced motion, they keep still in their
 * normal pose, and only the sleep face shows the sleep. */
export const nightPlan = (reduce: boolean): Curve[] =>
  reduce ? [] : PALS.flatMap((pal) => sleepPose(pal).concat(breath(pal, 0)));
