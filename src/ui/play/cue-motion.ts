// The timing of the last-song cue (play-sessions spec, "Screens and motion"), as in the sunset prototype (playCue).
// All times are in seconds after the load scene of the last song shows:
// - 0 s: the title music fades out over 0.4 s. The record sinks onto the horizon until 3.2 s: it is the sun.
// - 0.45 s: the music-box tune starts alone. The rays pulse on its 4 notes: 0.45, 0.75, 1.05, and 1.35 s.
// - From 0.5 s: the pals wave together and hop up and down 3 times, each pal a little after the one before it.
// - The ring shows the lower of the time out of 3.2 s and the load fill. The song starts at 3.2 s or when the load
//   ends, whichever is later (the load scene timing in LoadScene.tsx).

import type { SceneSound } from '../../sound';
import type { PalIndex } from '../pals/pal-svg';

/** The time of the ring and the minimum time of the cue. */
const CUE_SEC = 3.2;

/** The fade of the title music at the start of the cue. */
export const MUSIC_FADE_SEC = 0.4;

const NOTES = [0.45, 0.75, 1.05, 1.35] as const;

/** The tune of the cue: its first note. The 4 notes are in the file. */
export const CUE_SOUNDS: readonly SceneSound[] = [{ effect: 'last-song', at: NOTES[0] }];

/** The share of the ring to fill (0 to 1), `sec` seconds after the cue starts, with the load at `loadFill` (0 to 1). */
export const cueRing = (sec: number, loadFill: number): number => Math.min(Math.max(0, sec / CUE_SEC), 1, loadFill);

/** One key of a motion: its time, its value, and the easing to the next key (linear when absent). Before the first
 * key, the first value holds; after the last key, the last value holds. */
export type Key = readonly [at: number, value: number, easing?: string];

const EASE = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  in: 'cubic-bezier(0.55, 0, 0.8, 0.4)',
  sine: 'cubic-bezier(0.37, 0, 0.63, 1)',
} as const;

/** The scale of the rays: a short pulse on each note, and a longer, bigger pulse on the last note. */
export const RAY_PULSE: readonly Key[] = [
  [0, 1],
  ...NOTES.flatMap((at, k): Key[] => {
    const last = k === NOTES.length - 1;
    return [
      [at, 1, EASE.out],
      [at + 0.09, last ? 1.12 : 1.07, EASE.out],
      [at + (last ? 0.7 : 0.24), 1],
    ];
  }),
];

/** The rays turn slowly, in degrees. */
export const RAY_TURN: readonly Key[] = [
  [0, 0],
  [3.4, 14],
];

/** The glow behind the sun gets brighter up to the last note, in opacity. */
export const GLOW: readonly Key[] = [
  [0, 0.7, EASE.out],
  [NOTES[3] + 0.1, 1],
  [CUE_SEC, 0.9],
];

/** The sun sinks onto the horizon, in px of its vertical offset. */
export const SUN_SINK: readonly Key[] = [
  [0, -18, EASE.out],
  [CUE_SEC, 0],
];

/** The scene fades in, in opacity. */
export const FADE_IN: readonly Key[] = [
  [0, 0, EASE.out],
  [0.25, 1],
];

type Arm = 'left' | 'right';

/** A pal of the cue: its place in the band, its delay after Dot, and the arms that wave. Pip and Bo stand half behind
 * Dot, so each one waves with its outer arm only. Dot is last, so it stands in front. */
type CuePal = {
  readonly index: PalIndex;
  readonly place: string;
  readonly delay: number;
  readonly arms: readonly Arm[];
};

export const CUE_PALS: readonly CuePal[] = [
  { index: 0, place: 'pip', delay: 0.08, arms: ['left'] },
  { index: 2, place: 'bo', delay: 0.16, arms: ['right'] },
  { index: 1, place: 'dot', delay: 0, arms: ['left', 'right'] },
];

const WAVE_AT = 0.5;
const HOP_AT = 0.8;
const HOPS = 3;
const HOP_EVERY = 0.6;
const HOP_PX = 14;

/** The hops of a pal: up and down only, in px of its vertical offset. */
export const hopKeys = (delay: number): readonly Key[] => [
  [WAVE_AT + delay, 0],
  ...Array.from({ length: HOPS }, (_, k): Key[] => {
    const top = HOP_AT + delay + k * HOP_EVERY;
    return [
      [top - 0.15, 0, EASE.out],
      [top, -HOP_PX, EASE.in],
      [top + 0.2, 0],
    ];
  }).flat(),
];

const WAVES = 4;
const WAVE_HALF = 0.3;
const WAVE_OUT = 110;
const WAVE_LOW = 32;
const WAVE_HIGH = 70;
/** The rest of a raised arm, in degrees from up. Reduced motion shows the arms at this angle (cue.css). */
const ARM_REST = 45;

/** The wave of an arm, in degrees from up, outwards: the arm comes out from behind the pal, goes back and forth 4
 * times, and rests up. */
export const waveKeys = (delay: number): readonly Key[] => {
  const at = WAVE_AT + delay;
  const swings = Array.from({ length: WAVES }, (_, k): Key[] => {
    const from = at + 0.25 + k * 2 * WAVE_HALF;
    return [
      [from + WAVE_HALF, WAVE_HIGH, EASE.sine],
      [from + 2 * WAVE_HALF, WAVE_LOW, EASE.sine],
    ];
  }).flat();
  const end = at + 0.25 + WAVES * 2 * WAVE_HALF;
  return [[at, WAVE_OUT, EASE.out], [at + 0.25, WAVE_LOW, EASE.sine], ...swings, [end + 0.3, ARM_REST, EASE.in]];
};

/** The arm shows when the wave starts, in opacity. */
export const armShowKeys = (delay: number): readonly Key[] => [
  [WAVE_AT + delay, 0],
  [WAVE_AT + delay + 0.12, 1],
];
