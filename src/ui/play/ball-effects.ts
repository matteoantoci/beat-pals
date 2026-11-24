// The effects of the falling balls (prototype star-moments v2, `drawBallBack`, `drawBallFront`, `drawPhraseBack`,
// `drawPhraseFront`). They grow with the band energy, on all notes: step 1 a glow in the lane colour, step 2 a short
// sparkle trail, step 3 a comet tail, and gold a thin gold rim with gold trail sparkles. Each step keeps the effects
// below it, and each fades in and out with its step over 0.8 s. The back effects go into the pool of the notes, which
// the chutes clip, so each stays in its own lane (C5). They belong to the falling ball, not to a hit, so the limits of
// the hit effects (C4) do not change. A phrase ball has a wide gold glow that swells by 12% on each beat (its size, not
// its brightness, C12), and a thick double gold ring instead of the gold rim.

import { shapeKey } from './atlas';
import { noise } from './energy-stage';
import { laneX, noteY } from './geometry';
import { SPARKLE_R } from './paint-energy';
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

/** A trail sparkle is left behind every 45 ms and lives 0.3 s, at gold 0.38 s. */
const TRAIL_EVERY = 0.045;
const TRAIL_SEC = 0.3;
const TRAIL_GOLD_SEC = 0.08;

/** The swell of the phrase glow on a beat, and how fast it settles (about 0.25 s). */
const PULSE = { grow: 0.12, settle: 12 } as const;

/** The phrase glow scale `age` seconds after a beat. Reduced motion: no swell. */
export const phrasePulse = (age: number, reduced: boolean): number =>
  reduced || age < 0 ? 1 : 1 + PULSE.grow * Math.exp(-age * PULSE.settle);

/** The trail of the ball that `drawTrail` draws: its note time, the life and the share of its sparkles, whether they
 * are gold, and the sparkle number `j` that `drawTrailSparkle` draws. One object serves each frame (C20). */
const trail = { noteT: 0, life: 0, share: 0, gold: false, j: 0 };

/** The atlas key of trail sparkle `j`: white and the light lane colour, or at gold lemon and amber. */
const trailKey = (lane: Lane, j: number): string => {
  const odd = (j & 1) === 1;
  if (trail.gold) {
    return odd ? shapeKey.sparkleLemon : shapeKey.sparkleAmber;
  }
  return odd ? shapeKey.sparkleWhite : shapeKey.trailLight(lane);
};

/** Trail sparkle `trail.j`: left behind where the ball was at its time, while it lives. */
const drawTrailSparkle = (scene: BallScene, notes: Pool, ball: Ball): void => {
  const { geometry } = scene;
  const { j, life } = trail;
  const age = scene.t - (trail.noteT + j * TRAIL_EVERY);
  const y = noteY(geometry, -j * TRAIL_EVERY);
  if (age < 0 || age > life || y <= geometry.topY - 20) {
    return;
  }
  const k = age / life;
  const r = geometry.noteS / 2;
  const sparkle = notes.show(scene.textures.shape(trailKey(ball.lane, j)), ball.alpha * trail.share * (1 - k) * 0.95);
  sparkle.position.set(laneX(geometry, ball.lane) + (noise(ball.note, j * 2) * 2 - 1) * r * 0.55, y - r * 0.6);
  sparkle.scale.set(((4 + noise(ball.note, j * 2 + 1) * 3) * (1 - k * 0.6)) / SPARKLE_R);
  sparkle.rotation = scene.reduced ? 0 : age * 4;
};

/**
 * The sparkles that the ball left behind: one each 45 ms on a grid from its note time, each where the ball was then.
 * They stay where they were left, so they read as a trail and not as jitter.
 */
const drawTrail = (scene: BallScene, notes: Pool, ball: Ball): void => {
  const { fades } = scene.energy;
  trail.share = Math.max(fades[1], fades[3]);
  if (trail.share <= 0) {
    return;
  }
  trail.noteT = scene.t + ball.dt;
  trail.life = TRAIL_SEC + TRAIL_GOLD_SEC * fades[3];
  trail.gold = fades[3] > 0.5;
  const first = Math.ceil((scene.t - trail.life - trail.noteT) / TRAIL_EVERY);
  for (trail.j = first; trail.noteT + trail.j * TRAIL_EVERY <= scene.t; trail.j += 1) {
    drawTrailSparkle(scene, notes, ball);
  }
};

/**
 * The effects behind a ball, in the clipped pool of the notes: the comet tail and the trail (not on a soft hold, whose
 * band already runs up the chute), the glow, and the phrase glow.
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
  if (!ball.hold) {
    drawTrail(scene, notes, ball);
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
