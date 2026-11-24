// The shapes of prototype play-style A, painted with the 2D canvas API into the textures of the play screen. Each
// shape paints around (0, 0) unless it takes a position. PixiJS then only moves, scales, and fades the sprites.

import { css, LANE_COLORS, TOKENS } from '../pals/color';
import type { Lane } from '../../model';

export type Point = { readonly x: number; readonly y: number };
export type Ctx = CanvasRenderingContext2D;

export const TAU = Math.PI * 2;
export const ORIGIN: Point = { x: 0, y: 0 };

/** The colours of a lane as CSS strings. */
export const laneCss = (lane: Lane, alpha = 1): { base: string; dark: string; light: string } => {
  const colors = LANE_COLORS[lane];
  return { base: css(colors.base, alpha), dark: css(colors.dark, alpha), light: css(colors.light, alpha) };
};

export const WHITE = css(TOKENS.white);
export const LEMON = css(TOKENS.lemon);
const HIGHLIGHT = css(TOKENS.white, 0.8);

type Style = Partial<Pick<Ctx, 'fillStyle' | 'strokeStyle' | 'lineWidth' | 'globalAlpha'>>;

/** Sets the paint state of the canvas for the next fill or stroke. */
export const style = (ctx: Ctx, values: Style): void => {
  Object.assign(ctx, values);
};

/** The number of steps of a soft fade. */
const SOFT_STEPS = 16;

/**
 * Adds the colour stops of a soft fade to `gradient`: `color(1)` at the start and clear at the end, on a smoothstep
 * curve. The curve is flat at both ends, so a glow shows no edge. A straight fade shows its ends as rings.
 */
export const addSoftFade = (gradient: CanvasGradient, color: (alpha: number) => string): void => {
  Array.from({ length: SOFT_STEPS + 1 }, (_, i) => i / SOFT_STEPS).forEach((t) => {
    gradient.addColorStop(t, color(1 - t * t * (3 - 2 * t)));
  });
};

export const circlePath = (ctx: Ctx, centre: Point, radius: number): void => {
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, Math.max(0, radius), 0, TAU);
};

/** A star with `points` tips around (0, 0). `inner` is the inner radius as a share of the outer radius. */
export const starPath = (ctx: Ctx, radius: number, shape: { points: number; inner: number }): void => {
  ctx.beginPath();
  for (let tip = 0; tip < shape.points * 2; tip += 1) {
    const angle = (tip * Math.PI) / shape.points - Math.PI / 2;
    const r = tip % 2 === 1 ? radius * shape.inner : radius;
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
};

/** The chute of a lane: a tube with a round top from `top` down to `bottom`, `half` wide on each side of `x`. */
export const tubePath = (ctx: Ctx, x: number, tube: { top: number; bottom: number; half: number }): void => {
  const { top, bottom, half } = tube;
  ctx.beginPath();
  ctx.moveTo(x - half, top + half);
  ctx.arc(x, top + half, half, Math.PI, 0);
  ctx.lineTo(x + half, bottom);
  ctx.arc(x, bottom, half, 0, Math.PI);
  ctx.closePath();
};

/** The arch of Bo's mark: heavier at the bottom, so its box sits a little high. */
const archPath = (ctx: Ctx, size: number): void => {
  const w = size * 0.58;
  const h = size * 0.74;
  const top = -h / 2 - size * 0.025;
  ctx.beginPath();
  ctx.moveTo(-w / 2, top + h);
  ctx.lineTo(-w / 2, top + w / 2);
  ctx.arc(0, top + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(w / 2, top + h);
  ctx.closePath();
};

/**
 * The ring mark of a lane (C17): a flat silhouette of the pal body, about `size` across, centred on (0, 0). Pip a
 * circle, Dot a square, Bo an arch, with about the same area.
 */
export const palMark = (ctx: Ctx, lane: Lane, size: number): void => {
  if (lane === 0) {
    circlePath(ctx, ORIGIN, size * 0.36);
  } else if (lane === 1) {
    const w = size * 0.64;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -w / 2, w, w, size * 0.16);
  } else {
    archPath(ctx, size);
  }
  ctx.fill();
};

/** A note without its halo: a light bubble in the lane colour, a light rim, and one highlight (no gloss). */
const paintBubbleBody = (ctx: Ctx, lane: Lane, r: number): void => {
  const colors = laneCss(lane);
  // The 2 px small outline (C29). The light comes from the top left, as on every lit shape.
  const rim = 2;
  const core = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 0, 0, 0, r);
  core.addColorStop(0, colors.light);
  core.addColorStop(0.62, colors.base);
  core.addColorStop(1, colors.base);
  style(ctx, { fillStyle: core });
  circlePath(ctx, ORIGIN, r);
  ctx.fill();
  style(ctx, { strokeStyle: colors.light, lineWidth: rim });
  circlePath(ctx, ORIGIN, r - rim / 2);
  ctx.stroke();
  style(ctx, { fillStyle: HIGHLIGHT });
  circlePath(ctx, { x: -r * 0.4, y: -r * 0.4 }, r * 0.13);
  ctx.fill();
};

/** A note: the bubble with a small still halo. The light comes from the top left (C29). */
export const paintBubble = (ctx: Ctx, lane: Lane, size: number): void => {
  const r = size / 2;
  const halo = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.45);
  addSoftFade(halo, (a) => laneCss(lane, 0.45 * a).base);
  style(ctx, { fillStyle: halo });
  circlePath(ctx, ORIGIN, r * 1.45);
  ctx.fill();
  paintBubbleBody(ctx, lane, r);
};

/** A beat pill: a faint glow pill and a light core, `width` wide. Not a ball, so it never looks like a note. */
export const paintPill = (ctx: Ctx, lane: Lane, width: number): void => {
  const colors = laneCss(lane);
  style(ctx, { globalAlpha: 0.08, fillStyle: colors.base });
  ctx.beginPath();
  ctx.roundRect(-width / 2 - 4, -8, width + 8, 16, 8);
  ctx.fill();
  style(ctx, { globalAlpha: 0.55, fillStyle: colors.light });
  ctx.beginPath();
  ctx.roundRect(-width / 2, -2, width, 4, 2);
  ctx.fill();
  style(ctx, { globalAlpha: 1 });
};

/** A ring outline of `width` at `radius` in one colour. */
export const paintCircleLine = (ctx: Ctx, radius: number, line: { width: number; color: string }): void => {
  style(ctx, { strokeStyle: line.color, lineWidth: line.width });
  circlePath(ctx, ORIGIN, radius);
  ctx.stroke();
};

export const paintDisc = (ctx: Ctx, radius: number, color: string): void => {
  style(ctx, { fillStyle: color });
  circlePath(ctx, ORIGIN, radius);
  ctx.fill();
};
