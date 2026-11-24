// The atlas shapes of the ball effects, the phrase balls, and the star moment burst (see ./paint-star).

import { css, LANE_COLORS } from '../pals/color';
import { keyOf } from './hold-shapes';
import { paintEnergySparkle, SPARKLE_R } from './paint-energy';
import {
  BALL_GLOW_SHARE,
  EDGE_GLOW_R,
  paintBallGlow,
  paintEdgeGlow,
  paintPhraseGlow,
  paintStreak,
  PHRASE_GLOW_SHARE,
  STREAK,
} from './paint-star';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';
import type { Ctx } from './paint';

type Shape = { readonly key: string; readonly w: number; readonly h: number; readonly paint: (ctx: Ctx) => void };

const square = (key: string, size: number, paint: (ctx: Ctx) => void): Shape => ({ key, w: size, h: size, paint });

/** The keys of the shapes of the ball effects and the star moment. */
export const starKey = {
  ballGlow: keyOf('ball glow'),
  sparkleAmber: 'sparkle amber',
  phraseGlow: keyOf('phrase glow'),
  streak: 'streak',
  edgeGlow: 'edge glow',
} as const;

/** The shapes of one lane: its ball glow and its phrase glow. */
export const laneStarShapes = (geometry: Geometry, lane: Lane): Shape[] => {
  const r = geometry.noteS / 2;
  return [
    square(starKey.ballGlow(lane), 2 * r * BALL_GLOW_SHARE + 2, (ctx) => paintBallGlow(ctx, lane, r)),
    square(starKey.phraseGlow(lane), 2 * r * PHRASE_GLOW_SHARE + 2, (ctx) => paintPhraseGlow(ctx, lane, r)),
  ];
};

/** The shapes for all lanes: the burst. */
export const starShapes = (): Shape[] => [
  square(starKey.sparkleAmber, 2 * SPARKLE_R + 2, (ctx) => paintEnergySparkle(ctx, css(LANE_COLORS[1].dark))),
  { key: starKey.streak, w: STREAK.len, h: STREAK.w, paint: paintStreak },
  square(starKey.edgeGlow, 2 * EDGE_GLOW_R, paintEdgeGlow),
];
