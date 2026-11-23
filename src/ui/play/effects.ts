// The hit effects of style A (prototype `drawWave`, `drawSprinkles`, `drawMusicNote`, `drawClap`). Each effect stays
// in its own lane, from 1.5 ring diameters above the ring down to the floor (C5): a sprinkle outside that box is not
// drawn. The main burst ends in 0.6 s and all effects in 1.2 s (C4). With reduced motion, the effects fade in place
// (C16). A double hit adds the clap burst at the edge between its 2 lanes.

import { shapeKey } from './atlas';
import { laneX } from './geometry';
import { NOTE_HEAD, SPRINKLE_SIZE } from './paint-fx';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';
import type { Pool } from './pool';
import type { Textures } from './textures';

/** All effects of a hit end this long after the tap. */
export const EFFECT_SEC = 1.2;
const WAVE_SEC = 0.3;
const SPRINKLE_SEC = 0.6;
const NOTE_SEC = 0.8;
const CLAP_SEC = 0.4;
const GRAVITY = 760;

type Sprinkle = {
  readonly angle: number;
  readonly speed: number;
  readonly scale: number;
  readonly life: number;
  readonly spin: number;
  /** The kind and the colour: 0 a star in the lane colour, 1 a white dot, 2 a lemon stick. */
  readonly kind: number;
};

/** One hit, as the play screen shows it. */
export type HitRecord = {
  readonly lane: Lane;
  /** The song time of the tap. */
  readonly at: number;
  readonly great: boolean;
  /** The side to which the pal leans in its dance: it changes from hit to hit (P11), or faces the partner lane. */
  readonly side: 1 | -1;
  /** True for a lane of a double hit: the clap burst shows at the edge on the `side` of the lane. */
  readonly clap: boolean;
  readonly sprinkles: readonly Sprinkle[];
};

/** The sprinkles fly out of the upper edge of the ring and fall: never up the chute. Great hits have more. */
export const makeHit = (hit: Omit<HitRecord, 'sprinkles'>): HitRecord => {
  const count = hit.great ? 10 : 6;
  const sprinkles = Array.from({ length: count }, (_, index) => ({
    angle: Math.PI * (1.05 + (0.9 * (index + Math.random() * 0.6)) / count),
    speed: 120 + Math.random() * 110,
    scale: (5 + Math.random() * 3) / SPRINKLE_SIZE,
    life: 0.45 + Math.random() * 0.15,
    spin: (Math.random() - 0.5) * 12,
    kind: index % 3,
  }));
  return { ...hit, sprinkles };
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const easeOut = (value: number): number => 1 - (1 - clamp01(value)) ** 3;

/** What the effects of one frame need. */
export type EffectScene = {
  readonly pool: Pool;
  readonly geometry: Geometry;
  readonly textures: Textures;
  readonly reduced: boolean;
  /** The song time of the frame. */
  readonly t: number;
};

const drawWave = (scene: EffectScene, hit: HitRecord): void => {
  const k = (scene.t - hit.at) / WAVE_SEC;
  scene.pool.show(scene.textures.shape(shapeKey.wave(hit.lane)), {
    x: laneX(scene.geometry, hit.lane),
    y: scene.geometry.hitY,
    alpha: 1 - k,
    scale: scene.reduced ? 1 : 1 + 0.36 * easeOut(k),
  });
};

/** True when the point (`dx` from the middle of the lane) is inside the effect box of the lane. */
const inLane = (geometry: Geometry, dx: number, y: number): boolean =>
  Math.abs(dx) < geometry.laneW / 2 - SPRINKLE_SIZE &&
  y > geometry.hitY - geometry.ringD * 1.5 &&
  y < geometry.floorY + 16;

const drawSprinkle = (scene: EffectScene, hit: HitRecord, sprinkle: Sprinkle): void => {
  const { geometry, reduced } = scene;
  const { angle, speed, life } = sprinkle;
  const age = scene.t - hit.at;
  const start = geometry.ringD * 0.5;
  const travel = reduced ? 8 : speed * age;
  const dx = Math.cos(angle) * (start + travel);
  const fall = reduced ? 0 : GRAVITY * age * age;
  const y = geometry.hitY + Math.sin(angle) * (start * 0.8 + travel) + fall;
  const fade = reduced ? Math.sin((Math.PI * age) / life) : clamp01((life - age) / (life * 0.4));
  scene.pool.show(scene.textures.shape(shapeKey.sprinkle(hit.lane, sprinkle.kind)), {
    x: laneX(geometry, hit.lane) + dx,
    y,
    alpha: age < life && inLane(geometry, dx, y) ? fade : 0,
    scale: sprinkle.scale,
    rotation: sprinkle.spin * age,
  });
};

const drawSprinkles = (scene: EffectScene, hit: HitRecord): void => {
  for (const sprinkle of hit.sprinkles) {
    drawSprinkle(scene, hit, sprinkle);
  }
};

/** The small white music note at the side of the pal, below the hit line. */
const drawMusicNote = (scene: EffectScene, hit: HitRecord): void => {
  const { geometry, reduced } = scene;
  const k = (scene.t - hit.at) / NOTE_SEC;
  scene.pool.show(scene.textures.shape(shapeKey.musicNote), {
    x: laneX(geometry, hit.lane) + geometry.palH / 2 - 8 - NOTE_HEAD.x,
    y: geometry.floorY - geometry.palH * 0.55 - (reduced ? 0 : easeOut(k) * 16) - NOTE_HEAD.y,
    alpha: 1 - k * k,
  });
};

/**
 * The clap burst of a double hit at the lane edge that faces the partner: short white and lemon pills fly from the
 * edge into the own lane, and a soft white glow sits on the edge. The left lane of the pair draws the glow one time.
 */
const drawClap = (scene: EffectScene, hit: HitRecord, age: number): void => {
  if (!hit.clap || age >= CLAP_SEC) {
    return;
  }
  const { geometry, reduced } = scene;
  const k = age / CLAP_SEC;
  const x = laneX(geometry, hit.lane) + (hit.side * geometry.laneW) / 2;
  const y = geometry.hitY;
  const reach = reduced ? 14 : 10 + 22 * easeOut(k);
  if (hit.side > 0) {
    scene.pool.show(scene.textures.shape(shapeKey.clapGlow), { x, y, alpha: 0.4 * (1 - k) });
  }
  for (let pill = -2; pill <= 2; pill += 1) {
    const angle = (hit.side > 0 ? Math.PI : 0) + pill * 0.45;
    scene.pool.show(scene.textures.shape(shapeKey.clapPill(pill % 2 !== 0)), {
      x: x + Math.cos(angle) * reach,
      y: y + Math.sin(angle) * reach,
      alpha: 1 - k * k,
      rotation: angle,
    });
  }
};

/** Draws the effects of one hit at the song time of the scene. */
export const drawHit = (scene: EffectScene, hit: HitRecord | undefined): void => {
  const age = scene.t - (hit?.at ?? Number.NEGATIVE_INFINITY);
  if (hit === undefined || age < 0 || age >= EFFECT_SEC) {
    return;
  }
  if (age < WAVE_SEC) {
    drawWave(scene, hit);
  }
  if (age < SPRINKLE_SEC) {
    drawSprinkles(scene, hit);
  }
  if (age < NOTE_SEC) {
    drawMusicNote(scene, hit);
  }
  drawClap(scene, hit, age);
};
