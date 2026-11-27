// The motion of the session end and start (play-sessions spec, "Screens and motion"), as in the sunset prototype:
// the goodbye scene (./goodbye.ts), the night title (here), and the wake-up scene (./wake.ts). Each scene is a list
// of tracks on the scene clock in seconds: one track for each part and property, with its keys. ./timeline.ts plays
// a list on the parts of ./NightStage.tsx. The lists are data, so the tests check the squash and stretch and the
// scale of the sun and the moon on them.
// Reduced motion: every timed motion becomes a fade, the faces cross-fade, and the loops stop.

import type { PalFace, PalIndex } from '../pals/pal-svg';
import type { SunFace } from '../sun/Sun';

/** One key of a track: the scene time in seconds, the value, and the easing to the next key. */
export type Key = readonly [at: number, value: string, easing?: string];

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

export type Track = {
  readonly part: Part;
  readonly pal?: PalIndex;
  /** A CSS property: `opacity`, `scale`, `translate`, `rotate`, `background-color`, or `--sunc`. */
  readonly prop: string;
  readonly keys: readonly Key[];
  /** The track plays again and again. */
  readonly loop?: boolean;
};

/** A scale of the width and the height. */
type Squash = readonly [width: number, height: number];

/** The squash and stretch of the pals: at most 6% from 1.0 on each axis, also a pose and its loop together. */
export const BOW: Squash = [1.04, 0.94];
export const GOODBYE_YAWN: Squash = [0.97, 1.05];
export const SLEEP_POSE: Squash = [1.04, 0.94];
/** The slow breath of a sleeping pal, on the stack of faces, on top of the sleep pose. */
export const BREATH: Squash = [1.01, 1.03];
export const WAKE_STRETCH: Squash = [0.95, 1.06];

export const EASE = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  in: 'cubic-bezier(0.55, 0, 0.8, 0.4)',
  sine: 'cubic-bezier(0.37, 0, 0.63, 1)',
  set: 'cubic-bezier(0.45, 0, 0.75, 0.6)',
};

export const PALS: readonly PalIndex[] = [0, 1, 2];
/** The pals lean together in their sleep. */
export const LEAN = ['8deg', '0deg', '-8deg'] as const;
/** The sleeping pals sit a little lower. */
export const SLEEP_DROP = '0px 3px';

/** The arms of a pal: the left arm turns to the left (-1), the right arm to the right (1). */
export const ARMS = [
  { part: 'arm-left', side: -1 },
  { part: 'arm-right', side: 1 },
] as const;

export type Arm = (typeof ARMS)[number];

/** The scale value of a squash. */
export const scale = ([width, height]: Squash): string => `${String(width)} ${String(height)}`;
/** The rotation of an arm on its side. */
export const deg = (side: number, angle: number): string => `${String(side * angle)}deg`;

export const track = (part: Part, prop: string, keys: readonly Key[]): Track => ({ part, prop, keys });

/** The tracks of one pal. The pal tracks that loop (the breath) get their pal at once. */
export const onPal =
  (pal: PalIndex) =>
  (tracks: readonly Track[]): Track[] =>
    tracks.map(({ part, prop, keys }) => ({ part, prop, keys, pal }));

/** The time of a face change: a 0.08 s cut, or a 0.25 s fade with reduced motion. */
export const faceFade = (reduce: boolean): number => (reduce ? 0.25 : 0.08);

/** One face of a stack on from `from` (or from the start) until `to` (or the end). */
export const faceOn = (part: Part, [from, to]: readonly [number | 'start', number?], fade: number): Track => {
  const keys: Key[] =
    from === 'start'
      ? [[0, '1']]
      : [
          [from - fade, '0'],
          [from, '1'],
        ];
  return track(part, 'opacity', to === undefined ? keys : [...keys, [to - fade, '1'], [to, '0']]);
};

/** The keys of the face below and the face above at one change. The pictures share one outline, so a face above fades
 * over the face below it, and the face below switches while it is covered: the pal never turns see-through. */
const changeKeys = (at: number, fade: number, up: boolean): { before: Key[]; next: Key[] } =>
  up
    ? {
        next: [
          [at - fade, '0'],
          [at, '1'],
        ],
        before: [
          [at, '1'],
          [at + 0.001, '0'],
        ],
      }
    : {
        next: [
          [at - fade, '0'],
          [at - fade + 0.001, '1'],
        ],
        before: [
          [at - fade, '1'],
          [at, '0'],
        ],
      };

/** The faces of a pal in turn: [[face, from], ...]. `order` is the order of the faces in the stack, bottom first. */
export const faceSeq = (
  order: readonly PalFace[],
  seq: readonly (readonly [PalFace, number])[],
  fade: number
): Track[] => {
  const keys = new Map<PalFace, Key[]>(order.map((face) => [face, [[0, seq[0]?.[0] === face ? '1' : '0']]]));
  seq.slice(1).forEach(([face, at], step) => {
    const before = seq[step]?.[0] ?? face;
    const change = changeKeys(at, fade, order.indexOf(face) > order.indexOf(before));
    keys.get(face)?.push(...change.next);
    keys.get(before)?.push(...change.before);
  });
  return [...keys].map(([face, faceKeys]) => track(`face-${face}`, 'opacity', faceKeys));
};

/** The slow breath of a sleeping pal from `at`: 2 s in, 2 s out, each pal 0.7 s after the one before it. */
export const breath = (pal: PalIndex, at: number): Track => {
  const from = at + pal * 0.7;
  const keys: Key[] = [
    [from, '1 1', EASE.sine],
    [from + 2, scale(BREATH), EASE.sine],
    [from + 4, '1 1'],
  ];
  return { part: 'stack', pal, prop: 'scale', keys, loop: true };
};

/** The sleep pose of a pal from the start: low, leaning to the pal in the middle. */
const sleepPose = (pal: PalIndex): Track[] =>
  onPal(pal)([
    track('body', 'scale', [[0, scale(SLEEP_POSE)]]),
    track('body', 'translate', [[0, SLEEP_DROP]]),
    track('body', 'rotate', [[0, LEAN[pal]]]),
  ]);

/** The night title: the pals sleep in their pose and breathe slowly. With reduced motion, they keep still in their
 * normal pose, and only the sleep face shows the sleep. */
export const nightPlan = (reduce: boolean): Track[] =>
  reduce ? [] : PALS.flatMap((pal) => sleepPose(pal).concat(breath(pal, 0)));
