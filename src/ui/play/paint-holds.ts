// The shapes of the soft holds and the doubles (prototype play-style A: `drawTail`, `drawBead`, `drawDouble`,
// `drawHalfPop`). A hold band is a soft light band in the lane colour: a still halo, a body, and a lighter core, with
// small light dots that move with the band. Its body paints as a short strip that the sprite stretches, and a round cap
// closes its top. A white star bead marks the half of the hold. A double is 2 bubbles joined by a thick jelly band
// from one lane colour to the other; doubles are on 2 adjacent lanes only, so the band never arches.

import { css, TOKENS } from '../pals/color';
import { circlePath, laneCss, ORIGIN, paintBubble, paintCircleLine, starPath, style, WHITE, type Ctx } from './paint';
import type { Lane } from '../../model';

/** The halo of a hold band reaches this far past its body. */
export const BAND_HALO = 8;
/** The height of the band strip that the sprite stretches. */
export const BAND_STRIP = 16;
/** The light dots of a band are this far apart. */
export const BAND_DOT_GAP = 28;

const SHADOW = css(TOKENS.g950, 0.4);
const HIGHLIGHT = css(TOKENS.white, 0.8);
const STAR = { points: 5, inner: 0.5 } as const;

/** The look of a band: falling, or held by a finger (lighter, with a white core). */
type BandLook = { readonly lane: Lane; readonly half: number; readonly held: boolean };

/** The 3 layers of a band: the alpha, the colour, and the half width of each. */
const bandLayers = ({ lane, half, held }: BandLook): { alpha: number; color: string; half: number }[] => {
  const colors = laneCss(lane);
  return [
    { alpha: held ? 0.3 : 0.18, color: colors.base, half: half + BAND_HALO },
    { alpha: held ? 1 : 0.85, color: held ? colors.light : colors.base, half },
    { alpha: 0.8, color: held ? WHITE : colors.light, half: half * 0.34 },
  ];
};

/** A strip of the band body, `BAND_STRIP` tall: the sprite stretches it down the highway. */
export const paintBandStrip = (ctx: Ctx, look: BandLook): void => {
  for (const layer of bandLayers(look)) {
    style(ctx, { globalAlpha: layer.alpha, fillStyle: layer.color });
    ctx.fillRect(-layer.half, -BAND_STRIP / 2, layer.half * 2, BAND_STRIP);
  }
  style(ctx, { globalAlpha: 1 });
};

/** The round top of the band. Its flat edge lies on y = 0, and it paints upwards. */
export const paintBandCap = (ctx: Ctx, look: BandLook): void => {
  for (const layer of bandLayers(look)) {
    style(ctx, { globalAlpha: layer.alpha, fillStyle: layer.color });
    ctx.beginPath();
    ctx.arc(0, 0, layer.half, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  }
  style(ctx, { globalAlpha: 1 });
};

/** A light dot of the band. */
export const paintBandDot = (ctx: Ctx, lane: Lane, held: boolean): void => {
  style(ctx, { fillStyle: held ? laneCss(lane, 0.9).base : HIGHLIGHT });
  circlePath(ctx, ORIGIN, 2);
  ctx.fill();
};

/** The star bead at the half of a hold: a white star on a dark shadow in the lane colour. */
export const paintBead = (ctx: Ctx, lane: Lane, r: number): void => {
  style(ctx, { fillStyle: laneCss(lane).dark });
  ctx.translate(0, 2);
  starPath(ctx, r * 1.12, STAR);
  ctx.fill();
  ctx.translate(0, -2);
  style(ctx, { fillStyle: WHITE });
  starPath(ctx, r, STAR);
  ctx.fill();
};

/** The bead that pops when a hold is done: a lemon star on a dark shadow. */
export const paintPopStar = (ctx: Ctx, r: number): void => {
  style(ctx, { fillStyle: laneCss(1).dark });
  ctx.translate(0, 2);
  starPath(ctx, r * 1.1, STAR);
  ctx.fill();
  ctx.translate(0, -2);
  style(ctx, { fillStyle: css(TOKENS.lemon) });
  starPath(ctx, r, STAR);
  ctx.fill();
};

/** The white double band of a ring while a finger holds a soft hold (as the 6 px bands of `paintRingBands`). */
export const paintHeldBands = (ctx: Ctx, r: number): void => {
  paintCircleLine(ctx, r - 6, { width: 6, color: WHITE });
  paintCircleLine(ctx, r, { width: 6, color: WHITE });
};

/** The head of a held hold on its ring: the bubble with a white halo. */
export const paintHeldBubble = (ctx: Ctx, lane: Lane, size: number): void => {
  paintBubble(ctx, lane, size);
  style(ctx, { strokeStyle: css(TOKENS.white, 0.55), lineWidth: 6 });
  circlePath(ctx, ORIGIN, (size / 2) * 1.2);
  ctx.stroke();
};

/** A straight stroke from `-length / 2` to `length / 2` at height `y`. */
const linkLine = (ctx: Ctx, length: number, y: number): void => {
  ctx.beginPath();
  ctx.moveTo(-length / 2, y);
  ctx.lineTo(length / 2, y);
  ctx.stroke();
};

/**
 * The jelly band of a double between 2 adjacent lanes, `length` apart, centred on (0, 0): a soft shadow, a dark body,
 * a lighter body, and a gloss line. The bubbles are separate sprites on top.
 */
export const paintLink = (ctx: Ctx, lanes: readonly [Lane, Lane], shape: { length: number; noteS: number }): void => {
  const { length } = shape;
  const h = shape.noteS * 0.5;
  const gradient = (key: 'dark' | 'base'): CanvasGradient => {
    const fill = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
    fill.addColorStop(0.15, laneCss(lanes[0])[key]);
    fill.addColorStop(0.85, laneCss(lanes[1])[key]);
    return fill;
  };
  Object.assign(ctx, { lineCap: 'round' });
  style(ctx, { strokeStyle: SHADOW, lineWidth: h });
  linkLine(ctx, length, 4);
  style(ctx, { strokeStyle: gradient('dark') });
  linkLine(ctx, length, 0);
  style(ctx, { strokeStyle: gradient('base'), lineWidth: h * 0.76 });
  linkLine(ctx, length, -h * 0.08);
  style(ctx, { strokeStyle: HIGHLIGHT, lineWidth: h * 0.16, globalAlpha: 0.7 });
  linkLine(ctx, length, -h * 0.22);
  style(ctx, { globalAlpha: 1 });
};
