// The band energy on the PixiJS stage (spec, "Band energy"; prototype play-style A). Step 2: warm lane edges, floor
// sparkles. Step 3: a stage light. Gold: gold rims, a warm floor band under the pal shadows, more sparkles. No glow
// stays behind the pals. Reduced motion: nothing travels or turns, and the gold wave is not drawn (C16).

import { Sprite, type Container } from 'pixi.js';
import { shapeKey } from './atlas';
import { drawLevelUp } from './energy-level-up';
import { laneX } from './geometry';
import { GLOW_R, GOLD_FLOOR, SPARKLE_R, WARM_SIDE_H } from './paint-energy';
import { CHUTE_SHARE } from './paint-stage';
import { makePool, type Pool } from './pool';
import type { Lane, SongFacts } from '../../model';
import type { EnergyLook } from './energy';
import type { Geometry } from './geometry';
import type { Textures } from './textures';

/** A floor sparkle lives this long; 7 rise on each beat, and 24 at gold. */
const SPARKLE_SEC = 0.9;
const SPARKLES = { step2: 7, gold: 24 } as const;

/** The 3 layers of the energy: under the beat pills, over the rings, and over the hit effects. */
export type EnergyLayers = { readonly back: Container; readonly rims: Container; readonly front: Container };

export type EnergyParts = {
  readonly band: readonly Lane[];
  readonly stageLight: Sprite;
  readonly warmSides: readonly Sprite[];
  readonly warmCaps: readonly Sprite[];
  readonly goldFloor: Sprite;
  readonly floorSparkles: Pool;
  readonly goldRims: readonly Sprite[];
  readonly glow: Sprite;
  readonly wave: Sprite;
  readonly upSparkles: Pool;
};

/** What the energy of one frame needs. */
export type EnergyScene = {
  readonly geometry: Geometry;
  readonly textures: Textures;
  readonly reduced: boolean;
  readonly t: number;
  readonly energy: EnergyLook;
  readonly beats: readonly SongFacts['beats'][number][];
  /** A beat index at or after the beats whose floor sparkles still show. */
  readonly beat: number;
};

/** A still random number from 0 to 1 for a pair of integers, so a frozen time shows the same sparkles. */
const noise = (a: number, b: number): number => {
  let h = Math.imul(a ^ 0x9e_37_79_b9, 0x85_eb_ca_6b) ^ Math.imul(b + 0x63_2b_e5_ab, 0xc2_b2_ae_35);
  h = Math.imul(h ^ (h >>> 13), 0x27_d4_eb_2f);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
};

const sprite = (layer: Container): Sprite => {
  const made = layer.addChild(new Sprite());
  made.anchor.set(0.5);
  return made;
};

export const makeEnergyParts = (layers: EnergyLayers, band: readonly Lane[]): EnergyParts => ({
  band,
  stageLight: sprite(layers.back),
  warmSides: band.map(() => sprite(layers.back)),
  warmCaps: band.map(() => sprite(layers.back)),
  goldFloor: sprite(layers.back),
  floorSparkles: makePool(layers.back),
  goldRims: band.map(() => sprite(layers.rims)),
  glow: sprite(layers.front),
  wave: sprite(layers.front),
  upSparkles: makePool(layers.front),
});

/** Puts the still parts in place for a layout. */
export const dressEnergy = (parts: EnergyParts, geometry: Geometry, textures: Textures): void => {
  const { cx, floorY, laneW, hitY, topY } = geometry;
  const { stageLight, goldFloor, wave } = parts;
  const sideTop = geometry.chuteTop + laneW * CHUTE_SHARE;
  // Over the lower highway and the rings, up to the pal tops: no glow behind the pals, so their edges keep contrast.
  const light = { y: hitY - (hitY - topY) * 0.35, ry: (hitY - topY) * 0.35 + geometry.ringR - 12 };
  stageLight.texture = textures.shape(shapeKey.stageLight);
  stageLight.position.set(cx, light.y);
  stageLight.scale.set((laneW * 2.2) / GLOW_R, light.ry / GLOW_R);
  goldFloor.texture = textures.shape(shapeKey.goldFloor);
  goldFloor.position.set(cx, floorY + GOLD_FLOOR.drop);
  wave.texture = textures.shape(shapeKey.goldWave);
  parts.band.forEach((lane, at) => {
    const x = laneX(geometry, lane);
    parts.warmSides[at]?.position.set(x, (sideTop + hitY) / 2);
    parts.warmSides[at]?.scale.set(1, (hitY - sideTop) / WARM_SIDE_H);
    parts.warmCaps[at]?.position.set(x, hitY);
    parts.goldRims[at]?.position.set(x, hitY);
  });
  const dress = (sprites: readonly Sprite[], key: string): void => {
    for (const each of sprites) {
      each.texture = textures.shape(key);
    }
  };
  dress(parts.warmSides, shapeKey.warmSides);
  dress(parts.warmCaps, shapeKey.warmCap);
  dress(parts.goldRims, shapeKey.goldRim);
};

/** The first beat whose floor sparkles still show. */
const firstSparkleBeat = (scene: EnergyScene): number => {
  let at = Math.min(scene.beat, scene.beats.length);
  while (at > 0 && (scene.beats[at - 1]?.t ?? 0) > scene.t - SPARKLE_SEC) {
    at -= 1;
  }
  return at;
};

/** The sparkles that rise from the floor on one beat. */
const drawBeatSparkles = (scene: EnergyScene, pool: Pool, beat: number): void => {
  const { geometry, reduced, energy } = scene;
  const age = scene.t - (scene.beats[beat]?.t ?? Number.POSITIVE_INFINITY);
  const count = age < 0 ? 0 : SPARKLES.step2 + Math.round((SPARKLES.gold - SPARKLES.step2) * energy.fades[3]);
  const fade = energy.fades[1] * (1 - age / SPARKLE_SEC) * 0.8;
  for (let k = 0; k < count; k += 1) {
    const rise = reduced ? 0 : age * (50 + noise(beat, k * 4 + 1) * 30);
    const texture = scene.textures.shape(k % 2 === 1 ? shapeKey.sparkleWhite : shapeKey.sparkleLemon);
    const x = geometry.cx + (noise(beat, k * 4) * 2 - 1) * geometry.laneW * 1.5;
    const sparkle = pool.show(texture, fade);
    sparkle.position.set(x, geometry.floorY - 4 - rise);
    sparkle.scale.set((3.5 + noise(beat, k * 4 + 2) * 2.5) / SPARKLE_R);
    sparkle.rotation = reduced ? 0 : age * 2;
  }
};

/** The effects that stay while she is at a step, each at its fade. */
const drawLasting = (parts: EnergyParts, scene: EnergyScene): void => {
  const { fades } = scene.energy;
  const warm = fades[1];
  const light = fades[2];
  const gold = fades[3];
  const { stageLight, goldFloor, floorSparkles } = parts;
  stageLight.alpha = light;
  goldFloor.alpha = gold;
  for (const edge of parts.warmSides) {
    edge.alpha = warm;
  }
  for (const edge of parts.warmCaps) {
    edge.alpha = warm;
  }
  for (const rim of parts.goldRims) {
    rim.alpha = gold;
  }
  floorSparkles.begin();
  const last = warm > 0 ? scene.t : Number.NEGATIVE_INFINITY;
  for (let beat = firstSparkleBeat(scene); (scene.beats[beat]?.t ?? Number.POSITIVE_INFINITY) <= last; beat += 1) {
    drawBeatSparkles(scene, floorSparkles, beat);
  }
  floorSparkles.end();
};

/** Draws the energy of one frame. */
export const drawEnergy = (parts: EnergyParts, scene: EnergyScene): void => {
  drawLasting(parts, scene);
  drawLevelUp(parts, scene);
};
