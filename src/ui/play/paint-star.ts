// The shapes of the ball effects, the phrase balls, and the star moment burst (prototype star-moments v2), painted
// around (0, 0) for the texture atlas. The ball effects grow with the band energy: a glow (step 1) and a gold rim
// (gold). A phrase ball has a wide gold glow and a thick double gold ring. The burst has speed lines (tapered at both
// ends: a deep warm gold body and a thin hot core) and a light warm glow at the screen edges. The soft shapes are
// painted small and the sprites scale them up.

import { css, LANE_COLORS, TOKENS, type Oklch } from '../pals/color';
import { addSoftFade, circlePath, laneCss, ORIGIN, paintCircleLine, style } from './paint';
import type { Lane } from '../../model';
import type { Ctx } from './paint';

/** The amber of the gold rims: the dark shade of lemon (C27), as on the gold ring rims. */
const AMBER: Oklch = LANE_COLORS[1].dark;
/** The gold of the phrase rings and the warm gold glow of a phrase ball. */
const GOLD: Oklch = [0.9, 0.17, 90];
const PHRASE_HALO: Oklch = [0.86, 0.17, 85];

/** The step 1 glow reaches this many ball radii, the phrase glow this many. */
export const BALL_GLOW_SHARE = 2.1;
export const PHRASE_GLOW_SHARE = 2.3;

/** A radial glow from `inner` to `outer`: the colour at `alpha` at the inner radius, a soft fade to clear at the outer one. */
const paintRing = (
  ctx: Ctx,
  { inner, outer, color }: { inner: number; outer: number; color: (a: number) => string }
) => {
  const glow = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
  addSoftFade(glow, color);
  style(ctx, { fillStyle: glow });
  circlePath(ctx, ORIGIN, outer);
  ctx.fill();
};

/** Step 1: a soft glow in the lane colour around a ball of radius `r`, wider and stronger than its still halo. */
export const paintBallGlow = (ctx: Ctx, lane: Lane, r: number): void => {
  paintRing(ctx, { inner: r * 0.9, outer: r * BALL_GLOW_SHARE, color: (a) => laneCss(lane, 0.7 * a).base });
};

/** Gold: a thin gold rim on a darker amber line around a ball, like a small copy of the gold ring rims. */
export const paintBallRim = (ctx: Ctx, r: number): void => {
  paintCircleLine(ctx, r + 1, { width: 4, color: css(AMBER) });
  paintCircleLine(ctx, r + 1, { width: 2, color: css(TOKENS.lemon) });
};

/** The wide gold glow of a phrase ball. */
export const paintPhraseGlow = (ctx: Ctx, r: number): void => {
  paintRing(ctx, { inner: r * 0.9, outer: r * PHRASE_GLOW_SHARE, color: (a) => css(PHRASE_HALO, 0.75 * a) });
};

/** The thick double gold ring of a phrase ball: amber and gold, with a thin white outer line. */
export const paintPhraseRing = (ctx: Ctx, r: number): void => {
  paintCircleLine(ctx, r + 4, { width: 7, color: css(AMBER) });
  paintCircleLine(ctx, r + 4, { width: 4, color: css(GOLD) });
  paintCircleLine(ctx, r + 7.5, { width: 1.5, color: css(TOKENS.white, 0.8) });
};

/** A speed line is painted this long and this wide; the sprite scales it. Its head points to +x. */
export const STREAK = { len: 128, w: 12 } as const;

/** A linear gradient from (`x0`, `y0`) to (`x1`, `y1`) with these colour stops. */
const gradient = (
  ctx: Ctx,
  [x0, y0, x1, y1]: readonly [number, number, number, number],
  stops: readonly (readonly [number, string])[]
): CanvasGradient => {
  const made = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) {
    made.addColorStop(at, color);
  }
  return made;
};

const STREAK_EDGE = css([0.64, 0.17, 62], 0);
const STREAK_BODY = css([0.64, 0.17, 62], 0.45);
const STREAK_MID = css([0.72, 0.16, 76], 0.55);
const STREAK_CORE = css([0.97, 0.06, 100]);
/** Only the alpha of the mask counts. */
const CLEAR = 'rgba(0,0,0,0)';
const OPAQUE = 'rgba(0,0,0,1)';

/**
 * A speed line of the burst: a long thin spindle, pointed at both ends. Across its width it goes from clear at the edge
 * to a deep warm gold body and a thin hot lemon-white core, so only the core is bright (C11). Along its length it fades
 * in from the tail and out at the head, which reads as a soft motion blur.
 */
export const paintStreak = (ctx: Ctx): void => {
  const half = STREAK.len / 2;
  const w = STREAK.w / 2;
  // The mask below uses `destination-in`, which clears the whole canvas outside what it draws: the clip keeps it to
  // the box of this shape, so the rest of the atlas stays.
  ctx.beginPath();
  ctx.rect(-half, -w, STREAK.len, STREAK.w);
  ctx.clip();
  const across = gradient(
    ctx,
    [0, -w, 0, w],
    [
      [0, STREAK_EDGE],
      [0.3, STREAK_BODY],
      [0.42, STREAK_MID],
      [0.47, STREAK_CORE],
      [0.53, STREAK_CORE],
      [0.58, STREAK_MID],
      [0.7, STREAK_BODY],
      [1, STREAK_EDGE],
    ]
  );
  style(ctx, { fillStyle: across });
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.quadraticCurveTo(half * 0.1, -w * 2, half, 0);
  ctx.quadraticCurveTo(half * 0.1, w * 2, -half, 0);
  ctx.closePath();
  ctx.fill();
  const along = gradient(
    ctx,
    [-half, 0, half, 0],
    [
      [0, CLEAR],
      [0.45, OPAQUE],
      [0.85, OPAQUE],
      [1, CLEAR],
    ]
  );
  Object.assign(ctx, { globalCompositeOperation: 'destination-in', fillStyle: along });
  ctx.fillRect(-half, -w, STREAK.len, STREAK.w);
};

/** The edge glow is painted in a square of this half size; the sprite stretches it over the screen. */
export const EDGE_GLOW_R = 48;

/**
 * The light warm glow at the screen edges: clear in the middle, a deep warm gold toward the edges and the corners. Its
 * colour hardly changes the brightness of the grape plate (prototype star-moments, the wave edge light).
 */
export const paintEdgeGlow = (ctx: Ctx): void => {
  const glow = ctx.createRadialGradient(0, 0, EDGE_GLOW_R * 0.6, 0, 0, EDGE_GLOW_R * 1.42);
  glow.addColorStop(0, css([0.66, 0.16, 74], 0));
  glow.addColorStop(1, css([0.66, 0.16, 74], 0.36));
  style(ctx, { fillStyle: glow });
  ctx.fillRect(-EDGE_GLOW_R, -EDGE_GLOW_R, 2 * EDGE_GLOW_R, 2 * EDGE_GLOW_R);
};
