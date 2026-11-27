// The timeline of the end scene (spec, "Screens"; play-sessions spec, "Screens and motion"): what the scene shows,
// the moments of its parts in seconds, its length, and its sounds. The motion (motion.ts) moves the parts at these
// moments. The sounds follow the same timeline: the record at each slide-out, the star at its pop, the yawn just
// before the first pal yawns, and the new pal at its landing.

import { YAWN_SCENE_SEC, YAWN_SOUND_AT, type Yawn } from './yawn';
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
  /** The yawn at the end of the scene, or null (yawn.ts). */
  readonly yawn: Yawn | null;
};

export const RECORD_AT = 0.2;
export const FLY_AT = 1;
export const POP_AT = 1.8;
export const SWAP_AT = 2.2;
export const NEW_RECORD_AT = 2.6;
export const JUMP_AT = 3.3;
export const JUMP_SEC = 1;
export const LAND_AT = JUMP_AT + JUMP_SEC;

/** The length of the scene in seconds: 3 s, 3.5 s with a new record color, 4.75 s with the yawn, and 5 s when a pal
 * joins. */
export const sceneLength = (plan: ScenePlan): number => {
  if (plan.joins !== null) {
    return 5;
  }
  if (plan.yawn !== null) {
    return YAWN_SCENE_SEC;
  }
  return plan.opened ? 3.5 : 3;
};

/** The sounds of the scene: only the sounds of the moments that the plan shows. */
export const sceneSounds = (plan: ScenePlan): SceneSound[] => [
  { effect: 'record', at: RECORD_AT },
  ...(plan.star === null ? [] : [{ effect: 'star', at: POP_AT } satisfies SceneSound]),
  ...(plan.opened ? [{ effect: 'record', at: NEW_RECORD_AT } satisfies SceneSound] : []),
  ...(plan.yawn === null ? [] : [{ effect: 'yawn', at: YAWN_SOUND_AT } satisfies SceneSound]),
  ...(plan.joins === null ? [] : [{ effect: 'join', at: LAND_AT } satisfies SceneSound]),
];
