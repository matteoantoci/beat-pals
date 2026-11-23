// The still stage of the play screen (C14), painted one time for each layout: the background with its soft circles,
// the dark plate behind the band, the glass chutes, and the floor that the pals stand on. Nothing here moves during
// a song.

import { css, TOKENS } from '../pals/color';
import { laneX } from './geometry';
import { circlePath, laneCss, style, TAU, tubePath } from './paint';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';
import type { Ctx } from './paint';

const SKY_TOP = css([0.45, 0.18, 286]);
const SKY = css(TOKENS.g800);
const BACKDROP_DOT = css([0.5, 0.17, 284], 0.14);
const PLATE = css(TOKENS.g950, 0.4);
const PLATE_TOP = css(TOKENS.g950, 0);
const FLOOR_WIDE = css([0.2, 0.09, 285], 0.55);
const FLOOR_PAL = css([0.16, 0.08, 285], 0.6);
const DOTS = 9;

/** The chute of a lane is this share of the lane width. */
export const CHUTE_SHARE = 0.4;

/** A small seeded random source (mulberry32), so the circles of the background never change. */
const seeded = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/** The background of the app (a light from the top) with 9 still soft circles. */
const paintBackdrop = (ctx: Ctx, { width, height }: Geometry): void => {
  ctx.save();
  ctx.translate(width / 2, 0);
  ctx.scale(width * 1.3, height * 0.9);
  const sky = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(0.7, SKY);
  sky.addColorStop(1, SKY);
  style(ctx, { fillStyle: sky });
  ctx.fillRect(-1, 0, 2, 2);
  ctx.restore();
  const random = seeded(7);
  style(ctx, { fillStyle: BACKDROP_DOT });
  for (let dot = 0; dot < DOTS; dot += 1) {
    const centre = { x: random() * width, y: random() * (height + 300) - 150 };
    circlePath(ctx, centre, 40 + random() * 110);
    random();
    ctx.fill();
  }
};

/** The dark plate behind the lanes of the band. The band lists its lanes from left to right. */
const paintPlate = (ctx: Ctx, geometry: Geometry, band: readonly Lane[]): void => {
  const top = geometry.chuteTop - 8;
  const pad = geometry.laneW / 2 + 4;
  const left = laneX(geometry, band[0] ?? 1) - pad;
  const right = laneX(geometry, band.at(-1) ?? 1) + pad;
  const plate = ctx.createLinearGradient(0, top, 0, top + 120);
  plate.addColorStop(0, PLATE_TOP);
  plate.addColorStop(1, PLATE);
  style(ctx, { fillStyle: plate });
  ctx.beginPath();
  ctx.roundRect(left, top, right - left, geometry.floorY - 4 - top, [16, 16, 0, 0]);
  ctx.fill();
};

/** A glass chute: a soft fill that grows toward the ring, and a thin edge. */
const paintChute = (ctx: Ctx, geometry: Geometry, lane: Lane): void => {
  const tube = { top: geometry.chuteTop, bottom: geometry.hitY, half: geometry.laneW * CHUTE_SHARE };
  const x = laneX(geometry, lane);
  const fill = ctx.createLinearGradient(0, tube.top, 0, tube.bottom);
  fill.addColorStop(0, laneCss(lane, 0).base);
  fill.addColorStop(0.25, laneCss(lane, 0.1).base);
  fill.addColorStop(1, laneCss(lane, 0.2).base);
  style(ctx, { fillStyle: fill });
  tubePath(ctx, x, tube);
  ctx.fill();
  const edge = ctx.createLinearGradient(0, tube.top, 0, tube.bottom);
  edge.addColorStop(0, laneCss(lane, 0).base);
  edge.addColorStop(0.3, laneCss(lane, 0.45).base);
  edge.addColorStop(1, laneCss(lane, 0.7).base);
  style(ctx, { strokeStyle: edge });
  style(ctx, { lineWidth: 2 });
  ctx.stroke();
};

/** One soft dark ellipse under the band and a small shadow under each pal of the band. */
const paintFloor = (ctx: Ctx, geometry: Geometry, band: readonly Lane[]): void => {
  style(ctx, { fillStyle: FLOOR_WIDE });
  ctx.beginPath();
  ctx.ellipse(geometry.cx, geometry.floorY + 2, geometry.laneW * 1.75, 16, 0, 0, TAU);
  ctx.fill();
  style(ctx, { fillStyle: FLOOR_PAL });
  for (const lane of band) {
    ctx.beginPath();
    ctx.ellipse(laneX(geometry, lane), geometry.floorY, geometry.palH * 0.42, 7, 0, 0, TAU);
    ctx.fill();
  }
};

/** Paints the whole still stage for the band. */
export const paintStage = (ctx: Ctx, geometry: Geometry, band: readonly Lane[]): void => {
  paintBackdrop(ctx, geometry);
  paintPlate(ctx, geometry, band);
  for (const lane of band) {
    paintChute(ctx, geometry, lane);
  }
  paintFloor(ctx, geometry, band);
};
