// The shapes of the band energy (prototype play-style A, the energy steps), painted around (0, 0) for the texture
// atlas: the soft glows, the warm lane edges of step 2, the 4-point sparkles, and the gold rims, the gold floor,
// and the gold ring wave. The glows are smooth, so they are painted small and the sprites scale them up.

import { css, TOKENS, type Oklch } from '../pals/color';
import { circlePath, ORIGIN, paintCircleLine, starPath, style } from './paint';
import { paintFloor } from './paint-stage';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';
import type { Ctx } from './paint';

/** The amber of the gold rims and the gold floor: a warm shade of lemon. */
const AMBER: Oklch = [TOKENS.lemon[0] - 0.06, TOKENS.lemon[1], TOKENS.lemon[2] - 24];

type Glow = { readonly color: Oklch; readonly alpha: number };

/** The soft glows: the stage light of step 3 and the level-up glows. */
export const GLOWS = {
  stage: { color: TOKENS.white, alpha: 0.16 },
  white: { color: TOKENS.white, alpha: 0.08 },
  gold: { color: TOKENS.lemon, alpha: 0.1 },
} as const satisfies Readonly<Record<string, Glow>>;

/** The radius at which the glows, the sparkles, and the gold wave are painted. */
export const GLOW_R = 64;
export const SPARKLE_R = 6;
export const WAVE_R = 128;
/** The warm edge of step 2 is painted this high and stretched to the chute. */
export const WARM_SIDE_H = 64;
/** The gold rim sits this far outside the ring. */
const RIM_GAP = 7.5;
/** The gold floor: a soft band of light this high under the band, centred this far below the floor line. */
export const GOLD_FLOOR = { ry: 18, drop: 6, share: 1.9 } as const;
const WARM = { width: 6, color: css(TOKENS.lemon, 0.4), clear: css(TOKENS.lemon, 0) } as const;

/** A soft round glow: the colour in the middle, fading out at the edge. */
export const paintGlow = (ctx: Ctx, { color, alpha }: Glow): void => {
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, GLOW_R);
  glow.addColorStop(0, css(color, alpha));
  glow.addColorStop(1, css(color, 0));
  style(ctx, { fillStyle: glow });
  circlePath(ctx, ORIGIN, GLOW_R);
  ctx.fill();
};

/** The 2 straight warm edges of a chute, `half` from its middle: clear at the top, warm at the bottom. */
export const paintWarmSides = (ctx: Ctx, half: number): void => {
  const edge = ctx.createLinearGradient(0, -WARM_SIDE_H / 2, 0, WARM_SIDE_H / 2);
  edge.addColorStop(0, WARM.clear);
  edge.addColorStop(1, WARM.color);
  style(ctx, { fillStyle: edge });
  for (const side of [-1, 1]) {
    ctx.fillRect(side * half - WARM.width / 2, -WARM_SIDE_H / 2, WARM.width, WARM_SIDE_H);
  }
};

/** The warm edge of the round chute bottom, around the ring. (0, 0) is the ring centre. */
export const paintWarmCap = (ctx: Ctx, half: number): void => {
  style(ctx, { strokeStyle: WARM.color, lineWidth: WARM.width });
  ctx.beginPath();
  ctx.arc(0, 0, half, 0, Math.PI);
  ctx.stroke();
};

/** A small 4-point sparkle of the energy steps. */
export const paintEnergySparkle = (ctx: Ctx, color: string): void => {
  style(ctx, { fillStyle: color });
  starPath(ctx, SPARKLE_R, { points: 4, inner: 0.4 });
  ctx.fill();
};

/** The thick gold rim of a ring at gold: a 4 px gold band on a 7 px amber band. */
export const paintGoldRim = (ctx: Ctx, ringR: number): void => {
  paintCircleLine(ctx, ringR + RIM_GAP, { width: 7, color: css(AMBER) });
  paintCircleLine(ctx, ringR + RIM_GAP, { width: 4, color: css(TOKENS.lemon) });
};

/** The thin gold ring wave of the gold level-up. */
export const paintGoldWave = (ctx: Ctx): void => {
  paintCircleLine(ctx, WAVE_R, { width: 3, color: css(TOKENS.lemon) });
};

/** The size of the gold floor shape. */
export const goldFloorSize = (geometry: Geometry): { w: number; h: number } => ({
  w: 2 * geometry.laneW * GOLD_FLOOR.share + 4,
  h: 2 * (GOLD_FLOOR.ry + GOLD_FLOOR.drop) + 4,
});

/**
 * The warm band of gold light on the floor. The floor shadows of the stage are cut out of it, so the light lies
 * under them as in the prototype and the pals keep their dark footing. (0, 0) is the middle of the band.
 */
export const paintGoldFloor = (ctx: Ctx, geometry: Geometry, band: readonly Lane[]): void => {
  const rx = geometry.laneW * GOLD_FLOOR.share;
  const { w, h } = goldFloorSize(geometry);
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  ctx.save();
  ctx.scale(1, GOLD_FLOOR.ry / rx);
  const light = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  light.addColorStop(0, css(AMBER, 0.45));
  light.addColorStop(1, css(AMBER, 0));
  style(ctx, { fillStyle: light });
  circlePath(ctx, ORIGIN, rx);
  ctx.fill();
  ctx.restore();
  Object.assign(ctx, { globalCompositeOperation: 'destination-out' });
  ctx.translate(-geometry.cx, -(geometry.floorY + GOLD_FLOOR.drop));
  paintFloor(ctx, geometry, band);
};
