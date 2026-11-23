// The motion of the end scene (spec, "Screens"; prototype play-style A, views #end and #join), as Web Animations on
// the HTML parts. One timeline of at most 5 s:
// - 0.2 s: the record of the play slides out of the song sleeve.
// - 1.0 s: the new star flies from the band to its place on the record, and pops at 1.8 s.
// - 2.2 s: after a third star, the old record goes back into the sleeve, its stars go out, and the record of the
//   new color slides out at 2.6 s.
// - 3.3 s: at silver and gold, the new pal jumps into the band and lands at 4.3 s.
// The pals dance by the hit ratio, and confetti falls at 70% or more (party.ts). With reduced motion, each part
// fades in place: no spin, no jump, no dance, no confetti (C16).
// The sounds follow the same timeline (`sceneSounds`): the record at each slide-out, the star at its pop, and the
// new pal at its landing. With reduced motion, the parts fade in at the same moments, so the sounds keep their times.
// All animations keep their last frame, so `finish` on all of them gives the final state of the scene: the skip.

import { animate } from './animate';
import { confetti, dance, DANCE_FROM } from './party';
import type { Dance, Lane } from '../../model';
import type { SceneSound } from '../../sound';

/** What the scene shows, from the outcome of the play. */
export type ScenePlan = {
  /** The star place that the play filled, or null. */
  readonly star: number | null;
  /** True when the third star opened the next record color. */
  readonly opened: boolean;
  /** The pal that joins the band, or null. */
  readonly joins: Lane | null;
  readonly dance: Dance;
  /** The band of the play. */
  readonly band: readonly Lane[];
};

export type SceneParts = {
  readonly root: HTMLElement;
  readonly cover: HTMLElement;
  /** The record of the play color, behind the cover. */
  readonly record: HTMLElement;
  /** The record of the opened color, behind the cover. */
  readonly newRecord: HTMLElement | undefined;
  /** The lemon star of each of the 3 places. */
  readonly stars: readonly HTMLElement[];
  /** The sparkles around the place of the new star. */
  readonly starSparks: HTMLElement | undefined;
  /** For each pal (Pip, Dot, Bo): the body that jumps, and the picture that dances. */
  readonly bodies: readonly HTMLElement[];
  readonly pals: readonly HTMLElement[];
  /** The sparkles where the new pal lands. */
  readonly landSparks: HTMLElement | undefined;
  readonly confetti: HTMLElement;
};

type Scene = {
  readonly parts: SceneParts;
  readonly plan: ScenePlan;
  readonly reduced: boolean;
  /** The signed distance in px from the place of a record out of the sleeve to its place behind the cover. */
  readonly behind: number;
};

const RECORD_AT = 0.2;
const RECORD_SEC = 0.7;
const FLY_AT = 1;
const FLY_SEC = 0.8;
const POP_AT = 1.8;
const SWAP_AT = 2.2;
const NEW_RECORD_AT = 2.6;
const JUMP_AT = 3.3;
const JUMP_SEC = 1;
const LAND_AT = JUMP_AT + JUMP_SEC;
const SQUASH_SEC = 0.4;
const ARC_PX = 48;
const DANCE_STAGGER_SEC = 0.18;

/** The length of the scene in seconds: 3 s, 3.5 s with a new record color, and 5 s when a pal joins. */
export const sceneLength = (plan: ScenePlan): number => {
  if (plan.joins !== null) {
    return 5;
  }
  return plan.opened ? 3.5 : 3;
};

/** The sounds of the scene: only the sounds of the moments that the plan shows. */
export const sceneSounds = (plan: ScenePlan): SceneSound[] => [
  { effect: 'record', at: RECORD_AT },
  ...(plan.star === null ? [] : [{ effect: 'star', at: POP_AT } satisfies SceneSound]),
  ...(plan.opened ? [{ effect: 'record', at: NEW_RECORD_AT } satisfies SceneSound] : []),
  ...(plan.joins === null ? [] : [{ effect: 'join', at: LAND_AT } satisfies SceneSound]),
];

const centre = (el: Element): { x: number; y: number } => {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

const px = (value: number): string => `${String(value)}px`;

/** A record slides from behind the cover out of the sleeve, with a spin. */
const slideOut = ({ behind, reduced }: Scene, record: HTMLElement, at: number): void => {
  const keyframes = reduced
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ transform: `translateX(${px(behind)}) rotate(-120deg)` }, { transform: 'none' }];
  animate(record, keyframes, { at, sec: RECORD_SEC });
};

/** The old record goes back into the sleeve and its stars go out. */
const slideIn = ({ parts, behind, reduced }: Scene): void => {
  const end = reduced ? { opacity: 0 } : { transform: `translateX(${px(behind)})`, opacity: 0 };
  animate(parts.record, [{ opacity: 1 }, end], { at: SWAP_AT, sec: 0.4, fill: 'forwards', easing: 'ease-in' });
  for (const star of parts.stars) {
    animate(star, [{ opacity: 1 }, { opacity: 0 }], { at: SWAP_AT, sec: 0.3, fill: 'forwards' });
  }
};

/** 8 small stars in white and lemon open out and fade. */
const sparkle = (sparks: HTMLElement | undefined, at: number): void => {
  [...(sparks?.children ?? [])].forEach((spark, k) => {
    const turn = `rotate(${String(k * 45)}deg)`;
    const keyframes = [
      { transform: `${turn} translateX(40px) rotate(0turn)`, opacity: 1 },
      { transform: `${turn} translateX(76px) rotate(0.4turn)`, opacity: 0 },
    ];
    animate(spark, keyframes, { at, sec: 0.6, fill: 'none' });
  });
};

/** The point above the middle of the band, where the new star starts. */
const aboveBand = ({ parts, plan }: Scene): { x: number; y: number } => {
  const boxes = plan.band.flatMap((lane) => parts.bodies[lane] ?? []).map((body) => body.getBoundingClientRect());
  const x = boxes.reduce((sum, box) => sum + box.left + box.width / 2, 0) / Math.max(1, boxes.length);
  return { x, y: Math.min(...boxes.map((box) => box.top)) - 24 };
};

/** The new star flies from above the band to its place in an arc, then pops. */
const flyStar = (scene: Scene, star: HTMLElement): void => {
  if (scene.reduced) {
    animate(star, [{ opacity: 0 }, { opacity: 1 }], { at: FLY_AT, sec: FLY_SEC });
    return;
  }
  const from = aboveBand(scene);
  const to = centre(star);
  const start = `translate(${px(from.x - to.x)}, ${px(from.y - to.y)}) scale(0.5)`;
  const middle = `translate(${px((from.x - to.x) / 2)}, ${px((from.y - to.y) / 2 - ARC_PX)}) scale(0.75)`;
  const keyframes = [
    { transform: start, opacity: 0 },
    { transform: start, opacity: 1, offset: 0.02 },
    { transform: middle, opacity: 1 },
    { transform: 'none', opacity: 1 },
  ];
  animate(star, keyframes, { at: FLY_AT, sec: FLY_SEC });
  animate(star, [{ scale: '1' }, { scale: '1.25' }, { scale: '1' }], { at: POP_AT, sec: 0.3, fill: 'none' });
  sparkle(scene.parts.starSparks, POP_AT);
};

const JUMP: Keyframe[] = [
  { transform: 'none', easing: 'ease-out' },
  { transform: 'translateY(-160px)', easing: 'ease-in' },
  { transform: 'none' },
];
/** With reduced motion, the new pal fades out and fades in at its place, with no jump (C16). */
const FADE_PLACE: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }];

/** The new pal jumps from its waiting place into the band and lands with a squash. */
const join = ({ parts, reduced }: Scene, lane: Lane): void => {
  const body = parts.bodies[lane];
  const pal = parts.pals[lane];
  if (body === undefined || pal === undefined) {
    return;
  }
  if (reduced) {
    animate(body, FADE_PLACE, { at: JUMP_AT, sec: JUMP_SEC, easing: 'linear' });
    return;
  }
  animate(body, JUMP, { at: JUMP_AT, sec: JUMP_SEC, easing: 'linear' });
  const squash = [{ scale: '1 1' }, { scale: '1.14 0.86' }, { scale: '1 1' }];
  animate(pal, squash, { at: LAND_AT, sec: SQUASH_SEC, fill: 'none' });
  sparkle(parts.landSparks, LAND_AT);
};

/** The dancers by the hit ratio, each with its start: the new pal dances after it lands. */
const danceStarts = (plan: ScenePlan): ReadonlyMap<Lane, number> => {
  const lanes: readonly Lane[] = plan.dance === 'band' ? plan.band : [0, 1, 2];
  const first = (lane: Lane): number => (lane === plan.joins ? LAND_AT + SQUASH_SEC : DANCE_FROM);
  return new Map(lanes.map((lane) => [lane, first(lane) + lane * DANCE_STAGGER_SEC]));
};

/** Starts the whole scene. Returns the skip: it puts each part in its final state. */
export const playScene = (parts: SceneParts, plan: ScenePlan, reduced: boolean): (() => void) => {
  // Measured before the first animation moves the record.
  const scene: Scene = { parts, plan, reduced, behind: centre(parts.cover).x - centre(parts.record).x };
  const length = sceneLength(plan);
  slideOut(scene, parts.record, RECORD_AT);
  const star = plan.star === null ? undefined : parts.stars[plan.star];
  if (star !== undefined) {
    flyStar(scene, star);
  }
  if (plan.opened && parts.newRecord !== undefined) {
    slideIn(scene);
    slideOut(scene, parts.newRecord, NEW_RECORD_AT);
  }
  if (plan.joins !== null) {
    join(scene, plan.joins);
  }
  if (!reduced) {
    dance({ pals: parts.pals, starts: danceStarts(plan), length });
  }
  if (!reduced && plan.dance === 'party') {
    confetti(parts.confetti, length);
  }
  return () => {
    for (const animation of parts.root.getAnimations({ subtree: true })) {
      animation.finish();
    }
  };
};
