// The happy yawn of the end scene (play-sessions spec, "Screens and motion"; sunset prototype, screens "End scene ·
// tired" and "End scene · sunset"). Late in a session, the end scene shows that the pals are tired after the dance:
// - 2.95 s: the dance has stopped, and each pal sits down (1.05 × 0.94), 0.12 s after the pal before it.
// - 3.25 s: the first pal gives one happy yawn: it stretches up (0.96 × 1.06) with its arms out and the yawn face.
// - 4.5 s: the first pal sits again with its end face. The third pal ends at 4.74 s.
// The yawn sound plays at 3.2 s, and the button shows at 4.75 s, so the scene stays under 5 s.
// With reduced motion, only the faces change, with a fade: no sit, no stretch, no arms (C16).
// The pals are session pals (src/ui/pals/SessionPal.tsx): the motion moves their parts through their classes.

import { animate } from './animate';
import type { Lane, SunStage } from '../../model';
import type { PalFace } from '../pals/pal-svg';

/** The stage of the yawn: at late afternoon the pals end on the happy face, at sunset on a calm closed-eye smile. */
export type Yawn = Exclude<SunStage, 'day'>;

/** The sit of a pal, width × height. */
export const SIT = { x: 1.05, y: 0.94 } as const;
/** The stretch of a pal during its yawn, width × height. */
export const STRETCH = { x: 0.96, y: 1.06 } as const;

/** The yawn sound starts just before the yawn of the first pal. */
export const YAWN_SOUND_AT = 3.2;
/** The length of a scene with the yawn: the button shows after the yawn of the third pal. */
export const YAWN_SCENE_SEC = 4.75;

const SIT_AT = 2.95;
const SIT_SEC = 0.25;
const YAWN_AT = 3.25;
const YAWN_SEC = 1.25;
const STAGGER_SEC = 0.12;
/** The time of the stretch up at the start of the yawn, and of the sit down at its end. */
const STRETCH_SEC = 0.3;
/** The arms come out from behind the pal and go back in this time. */
const ARMS_SEC = 0.35;
/** A face changes with a fast fade, or with a slow fade under reduced motion. */
const FACE_SEC = 0.08;
const REDUCED_FACE_SEC = 0.25;

/** The yawn of the scene: from the late-afternoon stage on, only when the play opened no record color and no pal
 * joins. So the reward scenes stay as they are. */
export const yawnOf = (
  stage: SunStage,
  reward: { readonly opened: boolean; readonly joins: Lane | null }
): Yawn | null => (stage === 'day' || reward.opened || reward.joins !== null ? null : stage);

/** The times of one pal in seconds of the scene. */
type YawnTimes = { readonly sit: number; readonly yawn: number; readonly back: number };

/** When a pal sits down, starts its yawn, and sits again with its end face, in seconds of the scene. */
export const yawnTimes = (lane: Lane): YawnTimes => {
  const delay = lane * STAGGER_SEC;
  return { sit: SIT_AT + delay, yawn: YAWN_AT + delay, back: YAWN_AT + YAWN_SEC + delay };
};

/** The face of a pal after its yawn. */
export const endFace = (yawn: Yawn): PalFace => (yawn === 'sunset' ? 'joy' : 'happy');

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0, 0.8, 0.4)';
const EASE_SINE = 'cubic-bezier(0.37, 0, 0.63, 1)';

/** One key of a track: the scene time, the value, and the easing to the next key (linear by default). */
type Key = readonly [at: number, value: string, easing?: string];

/** One animation of one property through its keys. Before the first key the first value holds, and after the last
 * key the last value holds. */
const track = (el: Element, property: string, keys: readonly Key[]): void => {
  const from = keys[0]?.[0] ?? 0;
  const sec = (keys.at(-1)?.[0] ?? from) - from;
  const frames = keys.map(([at, value, easing]) => ({
    offset: (at - from) / sec,
    [property]: value,
    easing: easing ?? 'linear',
  }));
  animate(el, frames, { at: from, sec, easing: 'linear' });
};

const px = (x: number, y: number): string => `${String(x)}px ${String(y)}px`;
const scale = ({ x, y }: { readonly x: number; readonly y: number }): string => `${String(x)} ${String(y)}`;
const turn = (deg: number): string => `${String(deg)}deg`;

/** The faces of the stack in turn: the start face, the yawn face, and the end face. Each face fades in over the
 * face below it, and the face below goes out after that, so the pal never turns see-through. */
const changeFaces = (pal: Element, times: readonly number[], reduced: boolean): void => {
  const fade = reduced ? REDUCED_FACE_SEC : FACE_SEC;
  pal.querySelectorAll('.session-pal-face').forEach((face, k) => {
    const on = times[k];
    if (on === undefined) {
      return;
    }
    const keys: Key[] =
      k === 0
        ? []
        : [
            [on - fade, '0'],
            [on, '1'],
          ];
    const off = times[k + 1];
    if (off !== undefined) {
      keys.push([off, '1'], [off + 0.001, '0']);
    }
    if (keys.length > 0) {
      track(face, 'opacity', keys);
    }
  });
};

/** The pal sits down, stretches up with the yawn, and sits again. */
const sitAndStretch = (body: Element, { sit, yawn, back }: YawnTimes): void => {
  const settled = sit + SIT_SEC;
  track(body, 'scale', [
    [sit, '1 1', EASE_OUT],
    [settled, scale(SIT), EASE_IN_OUT],
    [yawn + STRETCH_SEC, scale(STRETCH)],
    [back - STRETCH_SEC, scale(STRETCH), EASE_IN_OUT],
    [back, scale(SIT)],
  ]);
  track(body, 'translate', [
    [sit, px(0, 0), EASE_OUT],
    [settled, px(0, 4), EASE_IN_OUT],
    [yawn + STRETCH_SEC, px(0, -2)],
    [back - STRETCH_SEC, px(0, -2), EASE_IN_OUT],
    [back, px(0, 4)],
  ]);
};

/** The arms come out from behind the pal and open wide for the yawn, then go back. */
const stretchArms = (pal: Element, { yawn, back }: YawnTimes): void => {
  pal.querySelectorAll('.session-pal-arm').forEach((arm) => {
    const side = arm.classList.contains('session-pal-arm-left') ? -1 : 1;
    track(arm, 'rotate', [
      [yawn, turn(side * 120), EASE_OUT],
      [yawn + ARMS_SEC, turn(side * 16), EASE_SINE],
      [back - ARMS_SEC, turn(side * 24), EASE_IN],
      [back, turn(side * 120)],
    ]);
    track(arm, 'opacity', [
      [yawn, '0'],
      [yawn + 0.1, '1'],
      [back - 0.1, '1'],
      [back, '0'],
    ]);
  });
};

const LANES: readonly Lane[] = [0, 1, 2];

/** One pal sits down and gives one happy yawn. With reduced motion, only its faces change. */
const yawnPal = (box: HTMLElement, lane: Lane, reduced: boolean): void => {
  const times = yawnTimes(lane);
  changeFaces(box, [0, times.yawn, times.back], reduced);
  const body = box.querySelector('.session-pal');
  if (reduced || body === null) {
    return;
  }
  sitAndStretch(body, times);
  stretchArms(box, times);
};

/** Each pal (Pip, Dot, Bo) sits down and gives one happy yawn, 0.12 s after the pal before it. `pals` holds the box
 * of each session pal. */
export const playYawn = (pals: readonly HTMLElement[], reduced: boolean): void => {
  LANES.forEach((lane) => {
    const box = pals[lane];
    if (box !== undefined) {
      yawnPal(box, lane, reduced);
    }
  });
};
