// The step of the sky strip on the song list, as Web Animations on the parts of ./SkyStrip.tsx, at the times of
// ./sun-step.ts. The old sky fades, and the sun moves down its arc, grows a little, warms up, and changes its face.
// With reduced motion, the old sun fades out and the new sun fades in: no move and no face change.

import { EASE, faceChangeSec, faceStackKeys, playKeys } from '../motion/keys';
import { RAYS, STEP_AT, STEP_END, stepPlan, SUN_COLORS, SUN_PLACES, SWELL } from './sun-step';
import type { SunStep } from '../../model';

/** The face changes on the face stack: each face shows from its time to the time of the next face. The 2 faces of a
 * change cross-fade. */
const playFaces = (sun: Element, step: SunStep): void => {
  const { faces, swell } = stepPlan(step);
  const keys = faceStackKeys(
    faces.map(({ at }) => at),
    faceChangeSec(false),
    false
  );
  faces.forEach(({ face }, index) => {
    playKeys(sun.querySelector(`.sun-face[data-face="${face}"]`), 'opacity', keys[index] ?? []);
  });
  if (swell) {
    playKeys(sun.querySelector('.sun-svg'), 'scale', [
      [swell.at, '1', EASE.out],
      [swell.top, String(SWELL), EASE.inOut],
      [swell.hold, String(SWELL), EASE.out],
      [swell.end, '1'],
    ]);
  }
};

/** The old sky fades out, its clouds drift (not with reduced motion), and the rim of the hill lights up at sunset. */
const playSky = (strip: HTMLElement, step: SunStep, reduce: boolean): void => {
  const old = strip.querySelector('.sky-from');
  playKeys(old, 'opacity', [
    [STEP_AT, '1', EASE.inOut],
    [STEP_END - 0.2, '0'],
  ]);
  for (const cloud of reduce ? [] : (old?.querySelectorAll('.sky-cloud') ?? [])) {
    playKeys(cloud, 'translate', [
      [STEP_AT, '0px 0px', EASE.sine],
      [STEP_END, '-36px 0px'],
    ]);
  }
  if (step.to === 'sunset') {
    playKeys(strip.querySelector('.sky-rim'), 'opacity', [
      [STEP_END - 0.8, '0', EASE.out],
      [STEP_END, '0.7'],
    ]);
  }
};

/** The sun moves from the old place to the new place, with uniform scale only, and takes the new colour and rays. */
const playSun = (strip: HTMLElement, sun: Element, step: SunStep): void => {
  const places = SUN_PLACES[matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait'];
  const [from, to] = [places[step.from], places[step.to]];
  playKeys(sun, 'translate', [
    [STEP_AT, `${String((from.x - to.x) * strip.offsetWidth)}px 0px`, 'cubic-bezier(0.3, 0.2, 0.4, 1)'],
    [STEP_END, '0px 0px'],
  ]);
  playKeys(sun.querySelector('.sun-y'), 'translate', [
    [STEP_AT, `0px ${String(from.y - to.y)}px`, 'cubic-bezier(0.6, 0, 0.7, 1)'],
    [STEP_END, '0px 0px'],
  ]);
  playKeys(sun.querySelector('.sun-s'), 'scale', [
    [STEP_AT, String(from.d / to.d), EASE.inOut],
    [STEP_END, '1'],
  ]);
  playKeys(sun, '--sunc', [
    [STEP_AT, SUN_COLORS[step.from], EASE.inOut],
    [STEP_END, SUN_COLORS[step.to]],
  ]);
  const rays = sun.querySelector('.sun-rays');
  playKeys(rays, 'opacity', [
    [STEP_AT, String(RAYS[step.from].opacity), EASE.inOut],
    [STEP_END - 0.4, String(RAYS[step.to].opacity)],
  ]);
  playKeys(rays, 'scale', [
    [STEP_AT, String(RAYS[step.from].scale), EASE.inOut],
    [STEP_END - 0.4, String(RAYS[step.to].scale)],
  ]);
};

export const playStep = (strip: HTMLElement, step: SunStep, reduce: boolean): void => {
  playSky(strip, step, reduce);
  if (reduce) {
    playKeys(strip.querySelector('.sky-sun-old'), 'opacity', [
      [STEP_AT, '1'],
      [STEP_AT + 1.2, '0'],
    ]);
    playKeys(strip.querySelector('.sky-sun-new'), 'opacity', [
      [STEP_AT + 0.6, '0'],
      [STEP_AT + 1.8, '1'],
    ]);
    return;
  }
  const sun = strip.querySelector('.sky-sun');
  if (sun) {
    playSun(strip, sun, step);
    playFaces(sun, step);
  }
};
