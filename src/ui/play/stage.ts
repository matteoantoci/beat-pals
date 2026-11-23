// The PixiJS play screen (spec, "Screens": play screen; ADR 0002). It draws the still stage, the beat pills, the
// rings, the notes, and the hit effects; the pals are HTML pictures above it. Rules of C20: one texture atlas, sprite
// pools, no Graphics drawn again in a frame, no filters, one mask, and resolution 2 at most with autoDensity.

import { Application } from 'pixi.js';
import { LOOK_AHEAD } from '../../model';
import { hex, TOKENS } from '../pals/color';
import { shapeKey } from './atlas';
import { drawHit, type EffectScene } from './effects';
import { drawEnergy, type EnergyScene } from './energy-stage';
import { clamp01, laneX, noteY } from './geometry';
import { drawNotes, type NoteFrame } from './stage-notes';
import { dress, makeParts, type Parts } from './stage-parts';
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
  readonly scene: Mutable<EffectScene>;
  readonly notes: Mutable<NoteFrame>;
  readonly energy: Mutable<EnergyScene>;
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
  parts.app.render();
};

/** The resize and the draw of the stage, over the textures of the layout. */
const control = (parts: Parts, geometry: Geometry): Omit<Stage, 'destroy'> & { textures: () => Textures } => {
  const scene: Mutable<EffectScene> = {
    pool: parts.effects,
    geometry,
    textures: makeTextures(geometry, parts.band, RESOLUTION),
    reduced: false,
    t: 0,
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
      }
    },
    draw: (view, reduced, energy) => {
      frame ??= {
        parts,
        scene,
        notes: { notes: parts.notes, links: parts.links, view, scene },
        energy: { ...scene, energy, beats: view.beats, beat: 0 },
      };
      scene.reduced = reduced;
      scene.t = view.t;
      frame.notes.view = view;
      const look = frame.energy;
      look.reduced = reduced;
      look.t = view.t;
      look.energy = energy;
      look.beats = view.beats;
      look.beat = view.first.beat;
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
