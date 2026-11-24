// The shapes of the ball effects, the phrase balls, and the star moment burst (prototype star-moments v2), painted
// around (0, 0) for the texture atlas. A plain ball gets a glow from energy step 1, and a phrase ball a wide gold glow.
// The burst has speed lines (tapered at both ends: a deep warm gold body and a thin hot core) and a light warm glow
// at the screen edges. The soft shapes are painted small and the sprites scale them up.

import { css, type Oklch } from '../pals/color';
import { addSoftFade, circlePath, laneCss, ORIGIN, style } from './paint';
import type { Lane } from '../../model';
import type { Ctx } from './paint';

/** The warm gold glow of a phrase ball. */
const PHRASE_HALO: Oklch = [0.86, 0.17, 85];

/** The step 1 glow reaches this many ball radii, the phrase glow this many. */
export const BALL_GLOW_SHARE = 2.1;
export const PHRASE_GLOW_SHARE = 2.3;

/**
 * Step 1: a soft glow in the lane colour around a ball of radius `r`, wider and stronger than its still halo. It
 * fades on the soft curve, so it shows no ring.
 */
export const paintBallGlow = (ctx: Ctx, lane: Lane, r: number): void => {
  const outer = r * BALL_GLOW_SHARE;
  const glow = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, outer);
  addSoftFade(glow, (a) => laneCss(lane, 0.7 * a).base);
  style(ctx, { fillStyle: glow });
  circlePath(ctx, ORIGIN, outer);
  ctx.fill();
};

/**
 * The wide gold glow of a phrase ball. It keeps a straight fade: its clear outer edge shows the swell on each beat,
 * which the soft fade hides (the parent liked the swell, 2026-11-24).
 */
export const paintPhraseGlow = (ctx: Ctx, r: number): void => {
  const outer = r * PHRASE_GLOW_SHARE;
  const glow = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, outer);
  glow.addColorStop(0, css(PHRASE_HALO, 0.75));
  glow.addColorStop(1, css(PHRASE_HALO, 0));
  style(ctx, { fillStyle: glow });
  circlePath(ctx, ORIGIN, outer);
  ctx.fill();
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
