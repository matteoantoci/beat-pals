// The burst of a star moment (prototype star-moments v2 `edge-safe`, polished after the parent's reference): speed
// lines in a ring around the screen edge that rush outward, in 3 waves on the beats of the song, tiny twinkling
// sparkles over the whole screen, and a light warm glow at the edges. The centre of the highway stays clear: no line
// starts inside an ellipse around it, and the lines only move outward. The cheer of the pals (HTML, above the canvas) is
// the focus. Only the thin core of a line and the sparkles are bright, so the bright area stays under C11. Reduced
// motion: no lines, the edge glow and the sparkles fade in and out in place (C16). A frame at the same song time always
// looks the same, and a frame makes no object (C20).

import { Sprite, type Container } from 'pixi.js';
import { shapeKey } from './atlas';
import { noise } from './energy-stage';
import { clamp01 } from './geometry';
import { SPARKLE_R } from './paint-energy';
import { EDGE_GLOW_R, STREAK } from './paint-star';
import { makePool, type Pool } from './pool';
import type { SongFacts } from '../../model';
import type { Geometry } from './geometry';
import type { Textures } from './textures';

/** The whole moment lasts this long after its start (a first value). */
const BURST_SEC = 2.4;
/** The waves of lines: the first at the start, each next one on the first beat at least `WAVE_GAP` after the one
 * before, or at that time when no beat comes within `WAVE_WAIT` (first values). */
const WAVES = 3;
const WAVE_GAP = 0.5;
const WAVE_WAIT = 0.4;
const LINES = 9;
/** A line lives this long: up in 0.08 s, full until 0.3 s, gone at 0.8 s. */
const LINE = { life: 0.8, up: 0.08, hold: 0.3 } as const;
const SPARKLES = 72;
/** The edge glow: up in 0.25 s (0.4 s with reduced motion), full until 1.3 s, gone at 2.2 s. */
const GLOW = { up: 0.25, reducedUp: 0.4, hold: 1.3, end: 2.2 } as const;

export type BurstParts = { readonly glow: Sprite; readonly lines: Pool; readonly sparkles: Pool };

/** What the burst of one frame needs. */
export type BurstScene = {
  readonly geometry: Geometry;
  readonly textures: Textures;
  readonly reduced: boolean;
  readonly t: number;
  readonly beats: readonly SongFacts['beats'][number][];
  /** The song time of the latest star moment at or before `t`, or -Infinity. */
  readonly starAt: number;
};

export const makeBurstParts = (layer: Container): BurstParts => {
  const glow = layer.addChild(new Sprite());
  glow.anchor.set(0.5);
  return { glow, lines: makePool(layer), sparkles: makePool(layer) };
};

/** Puts the edge glow over the screen for a layout. */
export const dressBurst = (parts: BurstParts, geometry: Geometry, textures: Textures): void => {
  const { glow } = parts;
  glow.texture = textures.shape(shapeKey.edgeGlow);
  glow.position.set(geometry.width / 2, geometry.height / 2);
  glow.scale.set(geometry.width / (2 * EDGE_GLOW_R), geometry.height / (2 * EDGE_GLOW_R));
};

const easeOut = (value: number): number => 1 - (1 - clamp01(value)) ** 3;

/** The time of the first beat at or after `t`, or Infinity. */
const beatAfter = (beats: BurstScene['beats'], t: number): number => {
  let low = 0;
  let high = beats.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    const before = (beats[middle]?.t ?? Number.POSITIVE_INFINITY) < t;
    low = before ? middle + 1 : low;
    high = before ? high : middle;
  }
  return beats[low]?.t ?? Number.POSITIVE_INFINITY;
};

/** The start of each wave, filled in each frame. */
const waveStarts = new Float64Array(WAVES);

const fillWaves = (scene: BurstScene): void => {
  waveStarts[0] = scene.starAt;
  for (let wave = 1; wave < WAVES; wave += 1) {
    const earliest = (waveStarts[wave - 1] ?? scene.starAt) + WAVE_GAP;
    const beat = beatAfter(scene.beats, earliest);
    waveStarts[wave] = beat - earliest <= WAVE_WAIT ? beat : earliest;
  }
};

/** The clear ellipse around the middle of the highway: its centre and its half axes. Each frame fills it in. */
const clear = { cx: 0, cy: 0, a: 1, b: 1 };
/** The line that `drawLine` draws: its wave, its number in the wave, and the seconds since its wave started. */
const line = { wave: 0, k: 0, age: 0 };

/** Draws `line`. */
const drawLine = (parts: BurstParts, scene: BurstScene): void => {
  const { wave, k, age } = line;
  const seed = wave * LINES + k;
  // The waves turn by half a step, so the lines of the next wave come between the lines of the one before.
  const angle = ((k + (wave % 2) * 0.5 + noise(seed, 1) * 0.6) * 2 * Math.PI) / LINES;
  const direction = angle + (noise(seed, 2) - 0.5) * 0.24;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const start = (1.02 + noise(seed, 3) * 0.25) / Math.hypot(ux / clear.a, uy / clear.b);
  const length = (90 + noise(seed, 4) * 150) * (0.5 + 0.5 * easeOut(age / 0.2));
  const tail = start + (40 + noise(seed, 5) * 60) * easeOut(age / LINE.life);
  const fade = age < LINE.up ? age / LINE.up : 1 - clamp01((age - LINE.hold) / (LINE.life - LINE.hold));
  const sprite = parts.lines.show(scene.textures.shape(shapeKey.streak), fade);
  sprite.position.set(
    clear.cx + ux * tail + Math.cos(direction) * (length / 2),
    clear.cy + uy * tail + Math.sin(direction) * (length / 2)
  );
  sprite.rotation = direction;
  // 7 to 13 px wide.
  sprite.scale.set(length / STREAK.len, 0.6 + noise(seed, 6) * 0.5);
};

/** The lines of wave `wave`, while it lives. */
const drawWave = (parts: BurstParts, scene: BurstScene, wave: number): void => {
  line.wave = wave;
  line.age = scene.t - (waveStarts[wave] ?? Number.POSITIVE_INFINITY);
  if (line.age < 0 || line.age >= LINE.life) {
    return;
  }
  for (line.k = 0; line.k < LINES; line.k += 1) {
    drawLine(parts, scene);
  }
};

const drawLines = (parts: BurstParts, scene: BurstScene): void => {
  const { geometry } = scene;
  clear.cx = geometry.cx;
  clear.cy = (geometry.topY + geometry.hitY) / 2;
  clear.a = geometry.laneW * 1.1;
  clear.b = (geometry.hitY - geometry.topY) / 2 + 30;
  fillWaves(scene);
  for (let wave = 0; wave < WAVES; wave += 1) {
    drawWave(parts, scene, wave);
  }
};

/** Sparkle `p`: tiny 4-point stars over the whole screen, each twinkles once in its life. */
const drawSparkle = (parts: BurstParts, scene: BurstScene, p: number): void => {
  const { geometry, reduced } = scene;
  const life = 0.5 + noise(p, 12) * 0.35;
  const a = scene.t - scene.starAt - noise(p, 11) * (BURST_SEC - 0.9);
  if (a < 0 || a > life) {
    return;
  }
  const swell = Math.sin((Math.PI * a) / life);
  const flicker = reduced ? 1 : 0.7 + 0.3 * Math.sin(a * 31 + p);
  const kind = p % 3;
  const key = kind === 0 ? shapeKey.sparkleWhite : kind === 1 ? shapeKey.sparkleLemon : shapeKey.sparkleAmber;
  const sparkle = parts.sparkles.show(scene.textures.shape(key), reduced ? swell : flicker);
  sparkle.position.set(noise(p, 13) * geometry.width, noise(p, 14) * geometry.height);
  const radius = 1 + noise(p, 15) * 2;
  sparkle.scale.set((reduced ? radius : radius * swell * (0.8 + 0.2 * Math.sin(a * 23 + p))) / SPARKLE_R);
  sparkle.rotation = reduced ? 0 : a * 3;
};

const drawSparkles = (parts: BurstParts, scene: BurstScene): void => {
  for (let p = 0; p < SPARKLES; p += 1) {
    drawSparkle(parts, scene, p);
  }
};

/** The light warm glow at the edges. */
const glowAlpha = (age: number, reduced: boolean): number => {
  const up = reduced ? GLOW.reducedUp : GLOW.up;
  return age < up ? age / up : 1 - clamp01((age - GLOW.hold) / (GLOW.end - GLOW.hold));
};

/** Draws the burst of the latest star moment, while it lasts. A wave that starts late keeps its lines to the end of
 * their life, so they fade out and do not stop at once. */
export const drawBurst = (parts: BurstParts, scene: BurstScene): void => {
  const { glow, lines, sparkles } = parts;
  const age = scene.t - scene.starAt;
  const on = age >= 0 && age < BURST_SEC;
  glow.visible = on;
  glow.alpha = on ? glowAlpha(age, scene.reduced) : 0;
  lines.begin();
  sparkles.begin();
  if (age >= 0 && age < BURST_SEC + LINE.life && !scene.reduced) {
    drawLines(parts, scene);
  }
  if (on) {
    drawSparkles(parts, scene);
  }
  lines.end();
  sparkles.end();
};
