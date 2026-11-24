// The effects of the falling balls (prototype star-moments v2, `drawBallBack`, `drawPhraseBack`). A plain ball gets
// one effect from the band energy: from step 1, a glow in the lane colour that fades in and out with its step over
// 0.8 s. A phrase ball has a wider glow in the lane colour that swells by 12% on each beat (its size, not its
// brightness, C12). The parent removed the sparkle trail, the comet tail, the gold rim of the plain balls, and the
// double gold ring of the phrase balls (2026-11-24): a trail or a tail makes a ball look longer, so the child can tap
// too early, and the pulsing glow alone marks a phrase ball best. The effects go into the pool of the notes, which the
// chutes clip, so each stays in its own lane (C5). They belong to the falling ball, not to a hit, so the limits of the
// hit effects (C4) do not change.

import { shapeKey } from './atlas';
import { laneX, noteY } from './geometry';
import type { Lane } from '../../model';
import type { EffectScene } from './effects';
import type { EnergyLook } from './energy';
import type { Pool } from './pool';

/** What the ball effects of one frame need. */
export type BallScene = EffectScene & {
  readonly energy: EnergyLook;
  /** The scale of the phrase glow in this frame: 1, and up to 1.12 just after a beat. */
  readonly pulse: number;
};

/** A ball: its note index, its lane, the seconds to its note time, its alpha, and whether it is in a phrase. */
export type Ball = { note: number; lane: Lane; dt: number; alpha: number; phrase: boolean };

/** The swell of the phrase glow on a beat, and how fast it settles (about 0.25 s). */
const PULSE = { grow: 0.12, settle: 12 } as const;

/** The phrase glow scale `age` seconds after a beat. Reduced motion: no swell. */
export const phrasePulse = (age: number, reduced: boolean): number =>
  reduced || age < 0 ? 1 : 1 + PULSE.grow * Math.exp(-age * PULSE.settle);

/**
 * The glow behind a ball, in the clipped pool of the notes: the pulsing phrase glow of a phrase ball, else the lane
 * glow from energy step 1. A phrase ball gets only its phrase glow, so the 2 glows do not stack into one bright spot.
 */
export const drawBallBack = (scene: BallScene, notes: Pool, ball: Ball): void => {
  const { geometry, textures, energy } = scene;
  const x = laneX(geometry, ball.lane);
  const y = noteY(geometry, ball.dt);
  if (ball.phrase) {
    const glow = notes.show(textures.shape(shapeKey.phraseGlow(ball.lane)), ball.alpha);
    glow.position.set(x, y);
    glow.scale.set(scene.pulse);
  } else if (energy.fades[0] > 0) {
    notes.show(textures.shape(shapeKey.ballGlow(ball.lane)), ball.alpha * energy.fades[0]).position.set(x, y);
  }
};
