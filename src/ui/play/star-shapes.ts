// The atlas shapes of the ball effects, the phrase balls, and the star moment burst (see ./paint-star).

import { css, LANE_COLORS } from '../pals/color';
import { keyOf, laneKeys } from './hold-shapes';
import { laneCss } from './paint';
import { paintEnergySparkle, SPARKLE_R } from './paint-energy';
import {
  BALL_GLOW_SHARE,
  EDGE_GLOW_R,
  paintBallGlow,
  paintBallRim,
  paintBallTail,
  paintEdgeGlow,
  paintPhraseGlow,
  paintPhraseRing,
  paintStreak,
  PHRASE_GLOW_SHARE,
  STREAK,
  TAIL_SHARE,
} from './paint-star';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';
import type { Ctx } from './paint';

type Shape = { readonly key: string; readonly w: number; readonly h: number; readonly paint: (ctx: Ctx) => void };

const square = (key: string, size: number, paint: (ctx: Ctx) => void): Shape => ({ key, w: size, h: size, paint });

const TRAIL_LIGHT = laneKeys('trail light');

/** The keys of the shapes of the ball effects and the star moment. */
export const starKey = {
  ballGlow: keyOf('ball glow'),
  ballTail: keyOf('ball tail'),
  /** A trail sparkle in the light colour of the lane. The white and the lemon ones are the energy sparkles. */
  trailLight: (lane: Lane): string => TRAIL_LIGHT[lane],
  sparkleAmber: 'sparkle amber',
  ballRim: 'ball rim',
  phraseGlow: 'phrase glow',
  phraseRing: 'phrase ring',
  streak: 'streak',
  edgeGlow: 'edge glow',
} as const;

/** The shapes of one lane: its ball glow, its comet tail, and its light trail sparkle. */
export const laneStarShapes = (geometry: Geometry, lane: Lane): Shape[] => {
  const r = geometry.noteS / 2;
  const len = geometry.noteS * TAIL_SHARE;
  return [
    square(starKey.ballGlow(lane), 2 * r * BALL_GLOW_SHARE + 2, (ctx) => paintBallGlow(ctx, lane, r)),
    { key: starKey.ballTail(lane), w: 2 * r, h: len, paint: (ctx) => paintBallTail(ctx, lane, { r, len }) },
    square(starKey.trailLight(lane), 2 * SPARKLE_R + 2, (ctx) => paintEnergySparkle(ctx, laneCss(lane).light)),
  ];
};

/** The shapes for all lanes: the gold rim, the phrase ball parts, and the burst. */
export const starShapes = (geometry: Geometry): Shape[] => {
  const r = geometry.noteS / 2;
  return [
    square(starKey.sparkleAmber, 2 * SPARKLE_R + 2, (ctx) => paintEnergySparkle(ctx, css(LANE_COLORS[1].dark))),
    square(starKey.ballRim, 2 * (r + 4), (ctx) => paintBallRim(ctx, r)),
    square(starKey.phraseGlow, 2 * r * PHRASE_GLOW_SHARE + 2, (ctx) => paintPhraseGlow(ctx, r)),
    square(starKey.phraseRing, 2 * (r + 9), (ctx) => paintPhraseRing(ctx, r)),
    { key: starKey.streak, w: STREAK.len, h: STREAK.w, paint: paintStreak },
    square(starKey.edgeGlow, 2 * EDGE_GLOW_R, paintEdgeGlow),
  ];
};
