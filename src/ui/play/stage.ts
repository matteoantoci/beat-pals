// The PixiJS play screen (spec, "Screens": play screen; ADR 0002). It draws the still stage, the beat pills, the
// rings, the notes with their energy effects and phrase balls, the hit effects, and the star moment burst; the pals are
// HTML pictures above it. Rules of C20: one texture atlas, sprite pools, no Graphics drawn again in a frame, no
// filters, one mask, and resolution 2 at most with autoDensity.

import { Application } from 'pixi.js';
import { LOOK_AHEAD } from '../../model';
import { hex, TOKENS } from '../pals/color';
import { shapeKey } from './atlas';
import { phrasePulse, type BallScene } from './ball-effects';
import { drawHit } from './effects';
import { drawEnergy, type EnergyScene } from './energy-stage';
import { clamp01, laneX, noteY } from './geometry';
import { drawNotes, type NoteFrame } from './stage-notes';
import { dress, makeParts, type Parts } from './stage-parts';
import { drawBurst, type BurstScene } from './star-burst';
import { makeTextures, type Textures } from './textures';
import type { Lane } from '../../model';
import type { EnergyLook } from './energy';
import type { Geometry } from './geometry';
import type { View } from './view';

export type Stage = {
  /** Paints the stage again for a new screen size. */
  readonly resize: (geometry: Geometry) => void;
  /** Draws the view and the band energy at its song time. */
  readonly draw: (view: View, reduced: boolean, energy: EnergyLook) => void;
  readonly destroy: () => void;
};

/** The chute glows in its lane colour after a hit, at most 0.15 extra alpha (C12). */
const GLOW_SEC = 0.25;
const GLOW_ALPHA = 0.15;
/** PixiJS draws at most 2 device pixels for each CSS pixel (C20). */
const RESOLUTION = Math.min(2, Math.max(1, globalThis.devicePixelRatio));

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * The objects that each frame fills in: what the effects, the notes, and the band energy need. The stage makes them
 * one time, at its first frame, so a frame makes no object (C20).
 */
type Frame = {
  readonly parts: Parts;
  readonly scene: Mutable<BallScene>;
  readonly notes: Mutable<NoteFrame>;
  readonly energy: Mutable<EnergyScene>;
  readonly burst: Mutable<BurstScene>;
};

/** The energy before the first frame. */
const NO_ENERGY: EnergyLook = { step: 0, fades: [0, 0, 0, 0], levelUp: undefined };

/** The seconds since the last beat at or before the frame time, or Infinity. */
const beatAge = (view: View): number => {
  let at = view.first.beat;
  while ((view.beats[at + 1]?.t ?? Number.POSITIVE_INFINITY) <= view.t) {
    at += 1;
  }
  const age = view.t - (view.beats[at]?.t ?? Number.NEGATIVE_INFINITY);
  return age >= 0 ? age : Number.POSITIVE_INFINITY;
};

const drawBeat = ({ parts, notes: { view }, scene }: Frame, at: number): void => {
  const beat = view.beats[at];
  const { geometry } = scene;
  const y = noteY(geometry, (beat?.t ?? 0) - view.t);
  if (beat === undefined || y < geometry.topY + 8 || y > geometry.hitY - geometry.ringD / 2 - 6) {
    return;
  }
  // A pill fades in over the top 35% of the highway.
  const alpha = clamp01((y - geometry.topY) / ((geometry.hitY - geometry.topY) * 0.35));
  for (const lane of parts.band) {
    parts.pills
      .show(scene.textures.shape(shapeKey.pill(lane, beat.downbeat)), alpha)
      .position.set(laneX(geometry, lane), y);
  }
};

const drawLanes = ({ parts, notes: { view }, scene }: Frame): void => {
  for (const { lane, ring, glow } of parts.lanes) {
    const state = view.lanes[lane];
    ring.update(state, scene.reduced);
    glow.alpha = state.hitAge < GLOW_SEC ? (1 - state.hitAge / GLOW_SEC) * GLOW_ALPHA : 0;
  }
};

const drawFrame = (frame: Frame): void => {
  const { parts, scene, notes, energy } = frame;
  const { view } = notes;
  drawLanes(frame);
  parts.pills.begin();
  for (let at = view.first.beat; (view.beats[at]?.t ?? Number.POSITIVE_INFINITY) <= view.t + LOOK_AHEAD; at += 1) {
    drawBeat(frame, at);
  }
  parts.pills.end();
  drawNotes(notes);
  parts.effects.begin();
  for (let at = view.first.hit; at < view.hits.length; at += 1) {
    drawHit(scene, view.hits[at]);
  }
  parts.effects.end();
  drawEnergy(parts.energy, energy);
  drawBurst(parts.burst, frame.burst);
  parts.app.render();
};

/**
 * Fills in the frame for the view at its song time and the band energy. `frame.scene.reduced` is already set. The
 * latest star moment is the last one at or before the frame time: the view remembers them in time order.
 */
const fillFrame = (frame: Frame, view: View, energy: EnergyLook): void => {
  const { scene, notes, energy: look, burst } = frame;
  const { reduced } = scene;
  scene.t = view.t;
  scene.energy = energy;
  scene.pulse = phrasePulse(beatAge(view), reduced);
  notes.view = view;
  look.reduced = reduced;
  look.t = view.t;
  look.energy = energy;
  look.beats = view.beats;
  look.beat = view.first.beat;
  burst.reduced = reduced;
  burst.t = view.t;
  burst.beats = view.beats;
  burst.starAt = view.stars.at(-1) ?? Number.NEGATIVE_INFINITY;
};

/** The resize and the draw of the stage, over the textures of the layout. */
const control = (parts: Parts, geometry: Geometry): Omit<Stage, 'destroy'> & { textures: () => Textures } => {
  const scene: Mutable<BallScene> = {
    pool: parts.effects,
    geometry,
    textures: makeTextures(geometry, parts.band, RESOLUTION),
    reduced: false,
    t: 0,
    energy: NO_ENERGY,
    pulse: 1,
  };
  dress(parts, geometry, scene.textures);
  let frame: Frame | undefined;
  return {
    textures: () => scene.textures,
    resize: (next) => {
      const old = scene.textures;
      scene.geometry = next;
      scene.textures = makeTextures(next, parts.band, RESOLUTION);
      dress(parts, next, scene.textures);
      old.destroy();
      if (frame) {
        frame.energy.geometry = next;
        frame.energy.textures = scene.textures;
        frame.burst.geometry = next;
        frame.burst.textures = scene.textures;
      }
    },
    draw: (view, reduced, energy) => {
      frame ??= {
        parts,
        scene,
        notes: { notes: parts.notes, links: parts.links, view, scene },
        energy: { ...scene, energy, beats: view.beats, beat: 0 },
        burst: { ...scene, beats: view.beats, starAt: Number.NEGATIVE_INFINITY },
      };
      scene.reduced = reduced;
      fillFrame(frame, view, energy);
      drawFrame(frame);
    },
  };
};

/** Makes the stage on the canvas for the lanes of the band. */
export const createStage = async (
  canvas: HTMLCanvasElement,
  geometry: Geometry,
  band: readonly Lane[]
): Promise<Stage> => {
  const app = new Application();
  await app.init({
    canvas,
    width: geometry.width,
    height: geometry.height,
    resolution: RESOLUTION,
    autoDensity: true,
    antialias: true,
    autoStart: false,
    preference: 'webgl',
    backgroundColor: hex(TOKENS.g800),
  });
  const { textures, resize, draw } = control(makeParts(app, band), geometry);
  return {
    resize,
    draw,
    destroy: () => {
      app.destroy({ removeView: false }, { children: true });
      textures().destroy();
    },
  };
};
