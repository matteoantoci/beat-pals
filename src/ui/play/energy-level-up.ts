// The level-up moment of the band energy on the PixiJS stage (spec, "Band energy"; prototype play-style A): a soft
// glow over the rings, sparkles from each pal of the band, and at gold the thin ring wave. Reduced motion: the
// sparkles do not travel or turn, and the gold wave is not drawn (C16).

import { shapeKey } from './atlas';
import { GOLD } from './energy';
import { laneX } from './geometry';
import { GLOW_R, SPARKLE_R, WAVE_R } from './paint-energy';
import type { EnergyLook } from './energy';
import type { EnergyParts, EnergyScene } from './energy-stage';

const easeOut = (value: number): number => 1 - (1 - value) ** 3;

type LevelUp = NonNullable<EnergyLook['levelUp']>;

/** The angle of sparkle `j` of a level-up to step `to`: a ring of 8 around the pal at gold, else a fan above it. */
const upAngle = (to: number, j: number): number =>
  to === GOLD ? (j * 2 * Math.PI) / 8 : -Math.PI / 2 + (j - to / 2) * 0.5;

/** Sparkle number `index` of the level-up moment: sparkle `j` at the pal of each lane of the band in turn. */
const drawUpSparkle = (parts: EnergyParts, scene: EnergyScene, index: number): void => {
  const up = scene.energy.levelUp;
  if (up === undefined) {
    return;
  }
  const { geometry, reduced } = scene;
  const { band } = parts;
  const j = Math.floor(index / band.length);
  const gold = up.to === GOLD;
  const reach = reduced ? 0 : easeOut(up.progress) * (gold ? 56 : 64);
  const angle = upAngle(up.to, j);
  const texture = scene.textures.shape(gold || j % 2 === 1 ? shapeKey.sparkleLemon : shapeKey.sparkleWhite);
  const sparkle = parts.upSparkles.show(texture, 1 - up.progress ** 2);
  sparkle.position.set(
    laneX(geometry, band[index % band.length] ?? 1) + Math.cos(angle) * reach,
    geometry.floorY - geometry.palH * (gold ? 0.5 : 1.05) + Math.sin(angle) * reach
  );
  sparkle.scale.set((gold ? 6 : 5) / SPARKLE_R);
  sparkle.rotation = reduced ? 0 : up.age * 3;
};

/** The soft glow over the rings, up to the pal tops (never a flash), and at gold the thin ring wave. */
const drawGlow = (parts: EnergyParts, scene: EnergyScene, up: LevelUp): void => {
  const { cx, ringR, hitY, laneW, floorY, palH } = scene.geometry;
  const { glow, wave } = parts;
  const gold = up.to === GOLD;
  const k = up.progress;
  glow.texture = scene.textures.shape(gold ? shapeKey.glowGold : shapeKey.glowWhite);
  glow.position.set(cx, hitY - ringR);
  glow.scale.set((laneW * (gold ? 2 : 1.5)) / GLOW_R, (2 * ringR - 12) / GLOW_R);
  glow.alpha = Math.sin(Math.PI * k);
  wave.visible = gold && !scene.reduced;
  wave.position.set(cx, floorY - palH * 0.6);
  wave.scale.set((palH * 0.6 + easeOut(k) * laneW * 1.3) / WAVE_R);
  wave.alpha = 1 - k;
};

/** The sparkles from each pal of the band: 2, 3, or 4 that rise, or 8 around it at gold. */
const drawUpSparkles = (parts: EnergyParts, scene: EnergyScene, up: LevelUp): void => {
  const each = up.to === GOLD ? 8 : up.to + 1;
  for (let index = 0; index < each * parts.band.length; index += 1) {
    drawUpSparkle(parts, scene, index);
  }
};

/** The level-up moment: the glow, the sparkles, and at gold the ring wave. */
export const drawLevelUp = (parts: EnergyParts, scene: EnergyScene): void => {
  const up = scene.energy.levelUp;
  const { glow, wave, upSparkles } = parts;
  glow.visible = up !== undefined;
  wave.visible = false;
  upSparkles.begin();
  if (up !== undefined) {
    drawGlow(parts, scene, up);
    drawUpSparkles(parts, scene, up);
  }
  upSparkles.end();
};
