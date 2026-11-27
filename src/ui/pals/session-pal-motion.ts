import { EASE, type Key } from '../motion/keys';

// The motion of the arms of a session pal (./SessionPal.tsx), which the session scenes share: the side of each arm,
// the wave (the goodbye scene and the last-song cue), and the stretch (the yawn of the end scene and the wake-up).
// The angles are in degrees from up, outwards: a scene turns them to the side of the arm (src/ui/motion/keys.ts deg).

/** The 2 arms of a session pal: the left arm turns to the left (-1), the right arm to the right (1). */
export const ARM_SIDES = [
  { arm: 'left', part: 'arm-left', selector: '.session-pal-arm-left', side: -1 },
  { arm: 'right', part: 'arm-right', selector: '.session-pal-arm-right', side: 1 },
] as const;

export type ArmSide = (typeof ARM_SIDES)[number];

/** An arm behind the pal points out at this angle. */
const BEHIND = 120;

const WAVE_OUT = 110;
const WAVE_LOW = 32;
const WAVE_HIGH = 70;
/** The time of one way of a wave. */
const WAVE_HALF = 0.3;
/** The time from the start of a wave to the first swing. */
const WAVE_SETTLE = 0.25;

/** The end of a wave that starts at `at` and goes back and forth `waves` times. */
export const waveEnd = (at: number, waves: number): number => at + WAVE_SETTLE + waves * 2 * WAVE_HALF;

/** A wave: the arm comes out from behind the pal at `at`, and goes back and forth `waves` times, 0.3 s each way. The
 * scene adds the end of the wave after `waveEnd`. */
export const armWaveKeys = (at: number, waves: number): Key<number>[] => [
  [at, WAVE_OUT, EASE.out],
  [at + WAVE_SETTLE, WAVE_LOW, EASE.sine],
  ...Array.from({ length: waves }, (_, k): Key<number>[] => {
    const from = at + WAVE_SETTLE + k * 2 * WAVE_HALF;
    return [
      [from + WAVE_HALF, WAVE_HIGH, EASE.sine],
      [from + 2 * WAVE_HALF, WAVE_LOW, EASE.sine],
    ];
  }).flat(),
];

/** A stretch: the arm comes out from behind the pal at `at` and opens wide (`open`: the time and the angle). It
 * closes a little (`close`: the time and the angle) before it goes behind the pal again at `end`. */
type Stretch = {
  readonly at: number;
  readonly end: number;
  readonly open: readonly [sec: number, angle: number];
  readonly close: readonly [sec: number, angle: number];
};

export const stretchKeys = ({ at, end, open, close }: Stretch): Key<number>[] => [
  [at, BEHIND, EASE.out],
  [at + open[0], open[1], EASE.sine],
  [end - close[0], close[1], EASE.in],
  [end, BEHIND],
];

/** The arm shows during a stretch: it fades in over 0.1 s at `at`, and fades out over the 0.1 s before `end`. */
export const stretchShowKeys = (at: number, end: number): Key[] => [
  [at, '0'],
  [at + 0.1, '1'],
  [end - 0.1, '1'],
  [end, '0'],
];
