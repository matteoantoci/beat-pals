// The texture atlas of the play screen (C20: one atlas). Each shape of the moving parts (notes, beat pills, ring
// layers, hit effects, and the band energy) is painted one time for each layout into one 2D canvas. A simple shelf
// packer places the shapes in rows. Each shape paints around (0, 0), so its sprite takes the anchor 0.5.

import { laneCss, LEMON, paintBubble, paintCircleLine, paintDisc, paintPill, WHITE } from './paint';
import {
  GLOW_R,
  GLOWS,
  goldFloorSize,
  paintGlow,
  paintGoldFloor,
  paintGoldRim,
  paintGoldWave,
  paintEnergySparkle,
  paintWarmCap,
  paintWarmSides,
  SPARKLE_R,
  WARM_SIDE_H,
  WAVE_R,
} from './paint-energy';
import {
  HALO_GAP,
  NOTE_HEAD,
  paintHalo,
  paintMusicNote,
  paintRingBands,
  paintRingFloor,
  paintSprinkle,
  paintStuds,
  SPRINKLE_KINDS,
  SPRINKLE_SIZE,
  sprinkleColors,
} from './paint-fx';
import { CHUTE_SHARE } from './paint-stage';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';
import type { Ctx } from './paint';

/** A place in the atlas, in CSS px. */
export type Frame = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

type Shape = { readonly key: string; readonly w: number; readonly h: number; readonly paint: (ctx: Ctx) => void };

const LANES: readonly Lane[] = [0, 1, 2];
const ROW_WIDTH = 1024;
const PAD = 2;
/** The beat pill of a downbeat is wider. */
const PILL_SHARE = { beat: 0.32, downbeat: 0.46 } as const;
/** The white core of a great hit. */
const CORE_R = 14;
/** The hit wave starts at the outer edge of the ring. */
const WAVE_GAP = 3;

/** The keys of the shapes. */
export const shapeKey = {
  bubble: (lane: Lane): string => `bubble ${String(lane)}`,
  pill: (lane: Lane, downbeat: boolean): string => `pill ${String(lane)} ${downbeat ? 'down' : 'beat'}`,
  ringFloor: (lane: Lane): string => `ring floor ${String(lane)}`,
  ringHit: (lane: Lane): string => `ring hit ${String(lane)}`,
  ringHalo: (lane: Lane): string => `ring halo ${String(lane)}`,
  ringBands: (lane: Lane): string => `ring bands ${String(lane)}`,
  ringNear: (lane: Lane): string => `ring near ${String(lane)}`,
  studs: (lane: Lane): string => `studs ${String(lane)}`,
  wave: (lane: Lane): string => `wave ${String(lane)}`,
  /** A sprinkle kind of the lane, in its own colour (see `SPRINKLE_KINDS`). */
  sprinkle: (lane: Lane, kind: number): string => `sprinkle ${String(lane)} ${String(kind)}`,
  core: 'core',
  whiteStuds: 'white studs',
  musicNote: 'music note',
  /** The band energy (./energy-stage). The glows are painted small and scaled up. */
  stageLight: 'stage light',
  glowWhite: 'glow white',
  glowGold: 'glow gold',
  warmSides: 'warm sides',
  warmCap: 'warm cap',
  sparkleWhite: 'sparkle white',
  sparkleLemon: 'sparkle lemon',
  goldRim: 'gold rim',
  goldFloor: 'gold floor',
  goldWave: 'gold wave',
} as const;

const square = (key: string, size: number, paint: (ctx: Ctx) => void): Shape => ({ key, w: size, h: size, paint });

/** The shapes of the band energy. The gold floor cuts out the floor shadows of the band. */
const energyShapes = (geometry: Geometry, band: readonly Lane[]): Shape[] => {
  const glow = 2 * GLOW_R + 2;
  const half = geometry.laneW * CHUTE_SHARE;
  const sparkle = 2 * SPARKLE_R + 2;
  return [
    square(shapeKey.stageLight, glow, (ctx) => paintGlow(ctx, GLOWS.stage)),
    square(shapeKey.glowWhite, glow, (ctx) => paintGlow(ctx, GLOWS.white)),
    square(shapeKey.glowGold, glow, (ctx) => paintGlow(ctx, GLOWS.gold)),
    { key: shapeKey.warmSides, w: 2 * half + 8, h: WARM_SIDE_H, paint: (ctx) => paintWarmSides(ctx, half) },
    square(shapeKey.warmCap, 2 * half + 8, (ctx) => paintWarmCap(ctx, half)),
    square(shapeKey.sparkleWhite, sparkle, (ctx) => paintEnergySparkle(ctx, WHITE)),
    square(shapeKey.sparkleLemon, sparkle, (ctx) => paintEnergySparkle(ctx, LEMON)),
    square(shapeKey.goldRim, 2 * (geometry.ringR + 12), (ctx) => paintGoldRim(ctx, geometry.ringR)),
    square(shapeKey.goldWave, 2 * WAVE_R + 6, paintGoldWave),
    { key: shapeKey.goldFloor, ...goldFloorSize(geometry), paint: (ctx) => paintGoldFloor(ctx, geometry, band) },
  ];
};

const pillShapes = (geometry: Geometry, lane: Lane): Shape[] =>
  [false, true].map((downbeat) => {
    const width = geometry.laneW * (downbeat ? PILL_SHARE.downbeat : PILL_SHARE.beat);
    return { key: shapeKey.pill(lane, downbeat), w: width + 12, h: 18, paint: (ctx) => paintPill(ctx, lane, width) };
  });

const ringShapes = (r: number, lane: Lane): Shape[] => {
  const ring = 2 * (r + 8);
  return [
    square(shapeKey.ringFloor(lane), ring, (ctx) => paintRingFloor(ctx, lane, r)),
    square(shapeKey.ringHit(lane), ring, (ctx) => paintDisc(ctx, r - 6, laneCss(lane).base)),
    square(shapeKey.ringHalo(lane), 2 * (r + HALO_GAP + 8), (ctx) => paintHalo(ctx, lane, r)),
    square(shapeKey.ringBands(lane), ring, (ctx) => paintRingBands(ctx, lane, { r, light: false })),
    square(shapeKey.ringNear(lane), ring, (ctx) => paintRingBands(ctx, lane, { r, light: true })),
    square(shapeKey.studs(lane), ring, (ctx) => paintStuds(ctx, r, laneCss(lane).light)),
    square(shapeKey.wave(lane), 2 * (r + WAVE_GAP + 2), (ctx) =>
      paintCircleLine(ctx, r + WAVE_GAP, { width: 2, color: laneCss(lane).base })
    ),
  ];
};

const sprinkleShapes = (lane: Lane): Shape[] =>
  SPRINKLE_KINDS.map((kind, at) => {
    const color = sprinkleColors(lane)[at] ?? WHITE;
    return square(shapeKey.sprinkle(lane, at), SPRINKLE_SIZE * 3, (ctx) => paintSprinkle(ctx, kind, color));
  });

/** All shapes of one layout for the band. */
const shapesOf = (geometry: Geometry, band: readonly Lane[]): Shape[] => {
  const r = geometry.ringR;
  const bubble = Math.ceil(geometry.noteS * 1.45 + 4);
  const shapes: Shape[] = [];
  for (const lane of LANES) {
    shapes.push(
      square(shapeKey.bubble(lane), bubble, (ctx) => paintBubble(ctx, lane, geometry.noteS)),
      ...pillShapes(geometry, lane),
      ...ringShapes(r, lane),
      ...sprinkleShapes(lane)
    );
  }
  shapes.push(
    square(shapeKey.core, 2 * CORE_R + 4, (ctx) => paintDisc(ctx, CORE_R, WHITE)),
    square(shapeKey.whiteStuds, 2 * (r + 8), (ctx) => paintStuds(ctx, r, WHITE)),
    { key: shapeKey.musicNote, w: 24 - NOTE_HEAD.x, h: 32, paint: paintMusicNote },
    ...energyShapes(geometry, band)
  );
  return shapes;
};

/** Places the shapes in rows, left to right. */
const pack = (shapes: readonly Shape[]): { frames: Map<string, Frame>; width: number; height: number } => {
  const frames = new Map<string, Frame>();
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const shape of shapes) {
    const w = Math.ceil(shape.w) + PAD;
    const h = Math.ceil(shape.h) + PAD;
    const wrap = x + w > ROW_WIDTH;
    y += wrap ? rowHeight : 0;
    rowHeight = wrap ? h : Math.max(rowHeight, h);
    x = wrap ? 0 : x;
    frames.set(shape.key, { x: x + PAD / 2, y: y + PAD / 2, w: Math.ceil(shape.w), h: Math.ceil(shape.h) });
    x += w;
  }
  return { frames, width: ROW_WIDTH, height: y + rowHeight };
};

/** Paints all shapes of the layout for the band into one canvas at `resolution` pixels for each CSS px. */
export const paintAtlas = (
  geometry: Geometry,
  band: readonly Lane[],
  resolution: number
): { canvas: HTMLCanvasElement; frames: Map<string, Frame> } => {
  const shapes = shapesOf(geometry, band);
  const { frames, width, height } = pack(shapes);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * resolution);
  canvas.height = Math.ceil(height * resolution);
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return { canvas, frames };
  }
  for (const shape of shapes) {
    const frame = frames.get(shape.key) ?? { x: 0, y: 0, w: 0, h: 0 };
    const centre = { x: (frame.x + frame.w / 2) * resolution, y: (frame.y + frame.h / 2) * resolution };
    ctx.setTransform(resolution, 0, 0, resolution, centre.x, centre.y);
    ctx.save();
    shape.paint(ctx);
    ctx.restore();
  }
  return { canvas, frames };
};
