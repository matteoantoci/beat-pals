// The step of the sun on the song list (play-sessions spec, "Screens and motion"): it plays one time when the shown
// stage changes, from 0.5 s to 3.1 s after the list opens. The sun moves down its arc to the next stage, and its face
// changes on the way:
// - Day to late afternoon: a slow blink. The eyes close, then open half way into the calm face.
// - Late afternoon to sunset: a happy yawn, and then the droopy face.
// - Day to sunset (a short limit): the blink and then the yawn, both inside the same 0.5 s to 3.1 s.
// The sun-step sound plays at 0.5 s. All times are in seconds after the list opens.

import type { SunStage, SunStep } from '../../model';
import type { SceneSound } from '../../sound';
import type { SunFace, SunRays } from './Sun';

export const STEP_AT = 0.5;
export const STEP_END = 3.1;

/** The face of the sun at each stage. */
export const STAGE_FACE: Readonly<Record<SunStage, SunFace>> = { day: 'happy', afternoon: 'calm', sunset: 'droopy' };

/** The colour of the sun at each stage. */
export const SUN_COLORS: Readonly<Record<SunStage, string>> = {
  day: 'oklch(0.89 0.16 96)',
  afternoon: 'oklch(0.86 0.16 76)',
  sunset: 'oklch(0.8 0.16 54)',
};

/** The rays of the sun at each stage. */
export const RAYS: Readonly<Record<SunStage, SunRays>> = {
  day: { opacity: 1, scale: 1 },
  afternoon: { opacity: 0.75, scale: 0.86 },
  sunset: { opacity: 0, scale: 0.72 },
};

/** One face of the step, and the time when it shows. */
type FaceCue = { readonly face: SunFace; readonly at: number };

/** The yawn makes the sun swell a little: one scale value, so the sun stays round. */
type Swell = { readonly at: number; readonly top: number; readonly hold: number; readonly end: number };

type StepPlan = { readonly faces: readonly FaceCue[]; readonly swell: Swell | null };

const PLANS: Readonly<Record<string, StepPlan>> = {
  'day-afternoon': {
    faces: [
      { face: 'happy', at: 0 },
      { face: 'blink', at: 1.5 },
      { face: 'calm', at: 1.85 },
    ],
    swell: null,
  },
  'afternoon-sunset': {
    faces: [
      { face: 'calm', at: 0 },
      { face: 'yawn', at: 1.4 },
      { face: 'droopy', at: 2.4 },
    ],
    swell: { at: 1.4, top: 1.7, hold: 2.2, end: 2.5 },
  },
  'day-sunset': {
    faces: [
      { face: 'happy', at: 0 },
      { face: 'blink', at: 1.1 },
      { face: 'calm', at: 1.4 },
      { face: 'yawn', at: 1.8 },
      { face: 'droopy', at: 2.7 },
    ],
    swell: { at: 1.8, top: 2.05, hold: 2.45, end: 2.75 },
  },
};

/** The faces and the swell of a step. A step that the session model never gives (up, or to the same stage) has none. */
export const stepPlan = (step: SunStep): StepPlan =>
  PLANS[`${step.from}-${step.to}`] ?? { faces: [{ face: STAGE_FACE[step.to], at: 0 }], swell: null };

/** The sound of a step: the sun-step note when the sun starts to move. */
export const STEP_SOUNDS: readonly SceneSound[] = [{ effect: 'sun-step', at: STEP_AT }];

/** The place of the sun in the sky strip: x as a share of the width, y in px below the top, disc diameter in px. */
export type SunPlace = { readonly x: number; readonly y: number; readonly d: number };

/** The place of the sun at each stage, in portrait and in landscape (the sunset prototype, STRIP_SUN). */
export const SUN_PLACES: Readonly<Record<'portrait' | 'landscape', Readonly<Record<SunStage, SunPlace>>>> = {
  portrait: { day: { x: 0.52, y: 46, d: 68 }, afternoon: { x: 0.7, y: 62, d: 74 }, sunset: { x: 0.8, y: 82, d: 84 } },
  landscape: { day: { x: 0.5, y: 42, d: 50 }, afternoon: { x: 0.66, y: 56, d: 54 }, sunset: { x: 0.8, y: 68, d: 60 } },
};
