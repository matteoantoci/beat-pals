// The effects of the falling balls (prototype star-moments v2, `drawBallBack`, `drawBallFront`, `drawPhraseBack`,
// `drawPhraseFront`). They grow with the band energy, on all notes: step 1 a glow in the lane colour, step 3 a comet
// tail, and gold a thin gold rim. Step 2 adds no ball effect: the parent removed the sparkle trail (2026-11-24),
// because a ball with a trail looks longer and the child can tap too early. Each step keeps the effects below it, and
// each fades in and out with its step over 0.8 s. The back effects go into the pool of the notes, which the chutes
// clip, so each stays in its own lane (C5). They belong to the falling ball, not to a hit, so the limits of the hit
// effects (C4) do not change. A phrase ball has a wide gold glow that swells by 12% on each beat (its size, not its
// brightness, C12), and a thick double gold ring instead of the gold rim.

import { shapeKey } from './atlas';
import { laneX, noteY } from './geometry';
import { TAIL_SHARE } from './paint-star';
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

/** A ball: its note index, its lane, the seconds to its note time, its alpha, whether it is in a phrase, and whether it
 * is the head of a soft hold. */
export type Ball = { note: number; lane: Lane; dt: number; alpha: number; phrase: boolean; hold: boolean };

/** The swell of the phrase glow on a beat, and how fast it settles (about 0.25 s). */
const PULSE = { grow: 0.12, settle: 12 } as const;

/** The phrase glow scale `age` seconds after a beat. Reduced motion: no swell. */
export const phrasePulse = (age: number, reduced: boolean): number =>
  reduced || age < 0 ? 1 : 1 + PULSE.grow * Math.exp(-age * PULSE.settle);

/**
 * The effects behind a ball, in the clipped pool of the notes: the comet tail (not on a soft hold, whose band already
 * runs up the chute), the glow, and the phrase glow.
 */
export const drawBallBack = (scene: BallScene, notes: Pool, ball: Ball): void => {
  const { geometry, textures, energy } = scene;
  const x = laneX(geometry, ball.lane);
  const y = noteY(geometry, ball.dt);
  const { fades } = energy;
  if (!ball.hold && fades[2] > 0) {
    const tail = notes.show(textures.shape(shapeKey.ballTail(ball.lane)), ball.alpha * fades[2]);
    tail.position.set(x, y - (geometry.noteS * TAIL_SHARE) / 2);
  }
  if (fades[0] > 0) {
    notes.show(textures.shape(shapeKey.ballGlow(ball.lane)), ball.alpha * fades[0]).position.set(x, y);
  }
  if (ball.phrase) {
    const glow = notes.show(textures.shape(shapeKey.phraseGlow), ball.alpha);
    glow.position.set(x, y);
    glow.scale.set(scene.pulse);
  }
};

/** The ring over a ball at `y`: the thick double gold ring of a phrase ball, else the gold rim at gold. */
export const drawBallFront = (scene: BallScene, pool: Pool, ball: Ball): void => {
  const { geometry, textures } = scene;
  const gold = scene.energy.fades[3];
  if (!ball.phrase && gold <= 0) {
    return;
  }
  const key = ball.phrase ? shapeKey.phraseRing : shapeKey.ballRim;
  pool
    .show(textures.shape(key), ball.alpha * (ball.phrase ? 1 : gold))
    .position.set(laneX(geometry, ball.lane), noteY(geometry, ball.dt));
};
