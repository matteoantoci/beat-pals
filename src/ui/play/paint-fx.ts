// The ring and hit effect shapes of prototype play-style A, painted around (0, 0) for the texture atlas.
// The ring is cut into layers, so PixiJS only fades and scales them: the near halo, the light bands of a near note,
// the hit fill, and the white core of a great hit.

import { css, TOKENS } from '../pals/color';
import { circlePath, laneCss, LEMON, ORIGIN, paintCircleLine, palMark, starPath, style, WHITE } from './paint';
import type { Lane } from '../../model';
import type { Ctx } from './paint';

const RING_FILL = css(TOKENS.g950, 0.6);
/** The inner band of a ring is this far inside the outer band. Both bands are 6 px wide. */
const BAND_GAP = 6;
const BAND = 6;
/** The near halo is drawn at this distance outside the ring and scaled with the nearness. */
export const HALO_GAP = 12;
const STUD_R = 3.2;

/** The ring floor: the dark fill and the flat pal mark of the lane (C17). */
export const paintRingFloor = (ctx: Ctx, lane: Lane, r: number): void => {
  style(ctx, { fillStyle: RING_FILL });
  circlePath(ctx, ORIGIN, r);
  ctx.fill();
  style(ctx, { globalAlpha: 0.35 });
  style(ctx, { fillStyle: laneCss(lane).light });
  palMark(ctx, lane, r * 0.66);
  style(ctx, { globalAlpha: 1 });
};

/** The 2 bands of a ring: the inner band at 0.6 and the outer band. `light` paints both in the light colour. */
export const paintRingBands = (ctx: Ctx, lane: Lane, ring: { r: number; light: boolean }): void => {
  const colors = laneCss(lane);
  const color = ring.light ? colors.light : colors.base;
  style(ctx, { globalAlpha: ring.light ? 1 : 0.6 });
  paintCircleLine(ctx, ring.r - BAND_GAP, { width: BAND, color });
  style(ctx, { globalAlpha: 1 });
  paintCircleLine(ctx, ring.r, { width: BAND, color });
};

/** The 4 little studs of a ring, like a toy. */
export const paintStuds = (ctx: Ctx, r: number, color: string): void => {
  style(ctx, { fillStyle: color });
  for (let stud = 0; stud < 4; stud += 1) {
    const angle = (stud * Math.PI) / 2 + Math.PI / 4;
    circlePath(ctx, { x: Math.cos(angle) * r, y: Math.sin(angle) * r }, STUD_R);
    ctx.fill();
  }
};

/** The soft halo around a ring when a note comes near. */
export const paintHalo = (ctx: Ctx, lane: Lane, r: number): void => {
  paintCircleLine(ctx, r + HALO_GAP, { width: 12, color: laneCss(lane).base });
};

/** The kinds of sprinkle (style A): a small star, a dot, and a stick. Each paints at the reference size 8. */
export const SPRINKLE_KINDS = ['star', 'dot', 'stick'] as const;
export type SprinkleKind = (typeof SPRINKLE_KINDS)[number];
export const SPRINKLE_SIZE = 8;

/** The colours of the sprinkles of a lane: the lane colour, white, and lemon only (A4, C5). */
export const sprinkleColors = (lane: Lane): readonly string[] => [laneCss(lane).base, WHITE, LEMON];

export const paintSprinkle = (ctx: Ctx, kind: SprinkleKind, color: string): void => {
  const size = SPRINKLE_SIZE;
  style(ctx, { fillStyle: color });
  if (kind === 'star') {
    starPath(ctx, size * 1.2, { points: 5, inner: 0.5 });
  } else if (kind === 'dot') {
    circlePath(ctx, ORIGIN, size * 0.6);
  } else {
    ctx.beginPath();
    ctx.roundRect(-size * 0.35, -size * 1.1, size * 0.7, size * 2.2, size * 0.35);
  }
  ctx.fill();
};

/** Where the head of the music note sits in its texture, from the texture centre. */
export const NOTE_HEAD = { x: -4, y: 8 } as const;

/** The small white music note of style A, at 0.7 of its first size. */
export const paintMusicNote = (ctx: Ctx): void => {
  ctx.translate(NOTE_HEAD.x, NOTE_HEAD.y);
  ctx.scale(0.7, 0.7);
  style(ctx, { fillStyle: WHITE });
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 6, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(5, -28, 3.4, 27);
  ctx.beginPath();
  ctx.moveTo(8.4, -28);
  ctx.quadraticCurveTo(20, -22, 16, -10);
  ctx.quadraticCurveTo(15, -18, 8.4, -19);
  ctx.fill();
};
