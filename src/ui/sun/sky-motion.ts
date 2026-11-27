// The step of the sky strip on the song list, as Web Animations on the parts of ./SkyStrip.tsx, at the times of
// ./sun-step.ts. The old sky fades, and the sun moves down its arc, grows a little, warms up, and changes its face.
// With reduced motion, the old sun fades out and the new sun fades in: no move and no face change.

import { STEP_AT, STEP_END, stepPlan, SUN_PLACES } from './sun-step';
import type { SunStage, SunStep } from '../../model';
import type { SunRays } from './Sun';

export const SUN_COLORS: Readonly<Record<SunStage, string>> = {
  day: 'oklch(0.89 0.16 96)',
  afternoon: 'oklch(0.86 0.16 76)',
  sunset: 'oklch(0.8 0.16 54)',
};

export const RAYS: Readonly<Record<SunStage, SunRays>> = {
  day: { opacity: 1, scale: 1 },
  afternoon: { opacity: 0.75, scale: 0.86 },
  sunset: { opacity: 0, scale: 0.72 },
};

const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_SINE = 'cubic-bezier(0.37, 0, 0.63, 1)';
/** The length of a face change: a short cut, as the faces of the pals. */
const CUT = 0.08;
const SWELL = '1.04';

/** One key of a track: the time in seconds, the value, and the easing to the next key. */
type Key = readonly [number, string | number, string?];

/** One Web Animation from scene times, which holds its first and last frame. */
const track = (el: Element | null | undefined, property: string, keys: readonly Key[]): void => {
  const start = keys[0]?.[0] ?? 0;
  const length = Math.max(0.001, (keys.at(-1)?.[0] ?? start) - start);
  el?.animate(
    keys.map(([at, value, easing]) => ({
      offset: (at - start) / length,
      [property]: value,
      easing: easing ?? 'linear',
    })),
    { delay: start * 1000, duration: length * 1000, fill: 'both' }
  );
};

/** The face changes on the face stack: each face shows from its time to the time of the next face. */
const playFaces = (sun: Element, step: SunStep): void => {
  const { faces, swell } = stepPlan(step);
  faces.forEach(({ face, at }, index) => {
    const next = faces[index + 1];
    const keys: Key[] =
      index === 0
        ? [[0, 1]]
        : [
            [at - CUT, 0],
            [at, 1],
          ];
    if (next) {
      keys.push([next.at - CUT, 1], [next.at, 0]);
    }
    track(sun.querySelector(`.sun-face[data-face="${face}"]`), 'opacity', keys);
  });
  if (swell) {
    track(sun.querySelector('.sun-svg'), 'scale', [
      [swell.at, '1', EASE_OUT],
      [swell.top, SWELL, EASE_IN_OUT],
      [swell.hold, SWELL, EASE_OUT],
      [swell.end, '1'],
    ]);
  }
};

/** The old sky fades out, its clouds drift (not with reduced motion), and the rim of the hill lights up at sunset. */
const playSky = (strip: HTMLElement, step: SunStep, reduce: boolean): void => {
  const old = strip.querySelector('.sky-from');
  track(old, 'opacity', [
    [STEP_AT, 1, EASE_IN_OUT],
    [STEP_END - 0.2, 0],
  ]);
  for (const cloud of reduce ? [] : (old?.querySelectorAll('.sky-cloud') ?? [])) {
    track(cloud, 'translate', [
      [STEP_AT, '0px 0px', EASE_SINE],
      [STEP_END, '-36px 0px'],
    ]);
  }
  if (step.to === 'sunset') {
    track(strip.querySelector('.sky-rim'), 'opacity', [
      [STEP_END - 0.8, 0, EASE_OUT],
      [STEP_END, 0.7],
    ]);
  }
};

/** The sun moves from the old place to the new place, with uniform scale only, and takes the new colour and rays. */
const playSun = (strip: HTMLElement, sun: Element, step: SunStep): void => {
  const places = SUN_PLACES[matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait'];
  const [from, to] = [places[step.from], places[step.to]];
  track(sun, 'translate', [
    [STEP_AT, `${(from.x - to.x) * strip.offsetWidth}px 0px`, 'cubic-bezier(0.3, 0.2, 0.4, 1)'],
    [STEP_END, '0px 0px'],
  ]);
  track(sun.querySelector('.sun-y'), 'translate', [
    [STEP_AT, `0px ${from.y - to.y}px`, 'cubic-bezier(0.6, 0, 0.7, 1)'],
    [STEP_END, '0px 0px'],
  ]);
  track(sun.querySelector('.sun-s'), 'scale', [
    [STEP_AT, String(from.d / to.d), EASE_IN_OUT],
    [STEP_END, '1'],
  ]);
  track(sun, '--sunc', [
    [STEP_AT, SUN_COLORS[step.from], EASE_IN_OUT],
    [STEP_END, SUN_COLORS[step.to]],
  ]);
  const rays = sun.querySelector('.sun-rays');
  track(rays, 'opacity', [
    [STEP_AT, RAYS[step.from].opacity, EASE_IN_OUT],
    [STEP_END - 0.4, RAYS[step.to].opacity],
  ]);
  track(rays, 'scale', [
    [STEP_AT, String(RAYS[step.from].scale), EASE_IN_OUT],
    [STEP_END - 0.4, String(RAYS[step.to].scale)],
  ]);
};

export const playStep = (strip: HTMLElement, step: SunStep, reduce: boolean): void => {
  playSky(strip, step, reduce);
  if (reduce) {
    track(strip.querySelector('.sky-sun-old'), 'opacity', [
      [STEP_AT, 1],
      [STEP_AT + 1.2, 0],
    ]);
    track(strip.querySelector('.sky-sun-new'), 'opacity', [
      [STEP_AT + 0.6, 0],
      [STEP_AT + 1.8, 1],
    ]);
    return;
  }
  const sun = strip.querySelector('.sky-sun');
  if (sun) {
    playSun(strip, sun, step);
    playFaces(sun, step);
  }
};
