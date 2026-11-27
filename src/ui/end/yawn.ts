// The happy yawn of the end scene (play-sessions spec, "Screens and motion"; sunset prototype, screens "End scene ·
// tired" and "End scene · sunset"). Late in a session, the end scene shows that the pals are tired after the dance:
// - 2.95 s: the dance has stopped, and every pal sits down (1.05 × 0.94) at the same time.
// - 3.25 s: the first pal gives one happy yawn: it stretches up (0.96 × 1.06) with its arms out and the yawn face.
// - 4.5 s: the first pal sits again with its end face. The third pal ends at 4.74 s.
// The yawn sound plays at 3.2 s, and the button shows at 4.75 s, so the scene stays under 5 s.
// With reduced motion, only the faces change, with a fade: no sit, no stretch, no arms (C16).
// The pals are session pals (src/ui/pals/SessionPal.tsx): the motion moves their parts through their classes.

import { deg, EASE, faceChangeSec, faceStackKeys, keysIn, playKeys, px, scale, type Squash } from '../motion/keys';
import { ARM_SIDES, stretchKeys, stretchShowKeys } from '../pals/session-pal-motion';
import type { Lane, SunStage } from '../../model';
import type { PalFace } from '../pals/pal-svg';

/** The stage of the yawn: at late afternoon the pals end on the happy face, at sunset on a calm closed-eye smile. */
export type Yawn = Exclude<SunStage, 'day'>;

/** The sit of a pal. */
export const SIT: Squash = [1.05, 0.94];
/** The stretch of a pal during its yawn. */
export const STRETCH: Squash = [0.96, 1.06];

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

/** The yawn of the scene: from the late-afternoon stage on, only when the play opened no record color and no pal
 * joins. So the reward scenes stay as they are. */
export const yawnOf = (
  stage: SunStage,
  reward: { readonly opened: boolean; readonly joins: Lane | null }
): Yawn | null => (stage === 'day' || reward.opened || reward.joins !== null ? null : stage);

/** The times of one pal in seconds of the scene. */
type YawnTimes = { readonly sit: number; readonly yawn: number; readonly back: number };

/** When a pal sits down, starts its yawn, and sits again with its end face, in seconds of the scene. All pals sit at
 * the same time; only the yawn of each pal comes 0.12 s after the yawn of the pal before it. */
export const yawnTimes = (lane: Lane): YawnTimes => {
  const delay = lane * STAGGER_SEC;
  return { sit: SIT_AT, yawn: YAWN_AT + delay, back: YAWN_AT + YAWN_SEC + delay };
};

/** The face of a pal after its yawn. */
export const endFace = (yawn: Yawn): PalFace => (yawn === 'sunset' ? 'joy' : 'happy');

/** The faces of the stack in turn: the start face, the yawn face, and the end face. Each face covers the face below
 * it, so the pal never turns see-through. The stack can hold one face 2 times, so the faces go by their place. */
const changeFaces = (pal: Element, times: readonly number[], reduced: boolean): void => {
  const keys = faceStackKeys(times, faceChangeSec(reduced), true);
  pal.querySelectorAll('.session-pal-face').forEach((face, k) => {
    const faceKeys = keys[k];
    if (faceKeys !== undefined) {
      playKeys(face, 'opacity', faceKeys);
    }
  });
};

/** The pal sits down, stretches up with the yawn, and sits again. */
const sitAndStretch = (body: Element, { sit, yawn, back }: YawnTimes): void => {
  const settled = sit + SIT_SEC;
  playKeys(body, 'scale', [
    [sit, '1 1', EASE.out],
    [settled, scale(SIT), EASE.inOut],
    [yawn + STRETCH_SEC, scale(STRETCH)],
    [back - STRETCH_SEC, scale(STRETCH), EASE.inOut],
    [back, scale(SIT)],
  ]);
  playKeys(body, 'translate', [
    [sit, px(0, 0), EASE.out],
    [settled, px(0, 4), EASE.inOut],
    [yawn + STRETCH_SEC, px(0, -2)],
    [back - STRETCH_SEC, px(0, -2), EASE.inOut],
    [back, px(0, 4)],
  ]);
};

/** The arms come out from behind the pal and open wide for the yawn, then go back. */
const stretchArms = (pal: Element, { yawn, back }: YawnTimes): void => {
  for (const { selector, side } of ARM_SIDES) {
    const arm = pal.querySelector(selector);
    playKeys(
      arm,
      'rotate',
      keysIn(stretchKeys({ at: yawn, end: back, open: [ARMS_SEC, 16], close: [ARMS_SEC, 24] }), (angle) =>
        deg(side, angle)
      )
    );
    playKeys(arm, 'opacity', stretchShowKeys(yawn, back));
  }
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
