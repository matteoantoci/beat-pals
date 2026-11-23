// The PixiJS play screen (spec, "Screens": play screen; ADR 0002). It draws the still stage, the beat pills, the
// rings, the notes, and the hit effects; the pals are HTML pictures above it. Rules of C20: one texture atlas, sprite
// pools, no Graphics drawn again in a frame, no filters, one mask, and resolution 2 at most with autoDensity.

import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { LOOK_AHEAD, type Lane } from '../../model';
import { hex, TOKENS } from '../pals/color';
import { shapeKey } from './atlas';
import { drawHit, type EffectScene } from './effects';
import { dressEnergy, drawEnergy, makeEnergyParts, type EnergyParts } from './energy-stage';
import { laneX, noteY } from './geometry';
import { CHUTE_SHARE } from './paint-stage';
import { makePool, type Pool } from './pool';
import { makeRing, type Ring } from './rings';
import { drawNotes } from './stage-notes';
import { makeTextures, type Textures } from './textures';
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

/** The chute glows after a hit, at most 0.15 extra alpha (C12). */
const GLOW_SEC = 0.25;
const GLOW_ALPHA = 0.15;
/** PixiJS draws at most 2 device pixels for each CSS pixel (C20). */
const RESOLUTION = Math.min(2, Math.max(1, globalThis.devicePixelRatio));

type Parts = {
  readonly app: Application;
  readonly band: readonly Lane[];
  readonly backdrop: Sprite;
  readonly glows: readonly Graphics[];
  readonly mask: Graphics;
  readonly rings: readonly Ring[];
  readonly pills: Pool;
  readonly notes: Pool;
  /** The parts that cross between the chutes or sit on the rings: doubles, held heads, and popped beads. */
  readonly links: Pool;
  readonly effects: Pool;
  readonly energy: EnergyParts;
};

/** One frame: the parts, the view, the band energy, and what the effects need. */
type Frame = { readonly parts: Parts; readonly view: View; readonly energy: EnergyLook; readonly scene: EffectScene };

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** The chute shape of a lane as a Graphics path, for the glow and the note mask. */
const chute = (graphics: Graphics, geometry: Geometry, lane: Lane): Graphics => {
  const half = geometry.laneW * CHUTE_SHARE;
  const top = geometry.chuteTop;
  return graphics.roundRect(laneX(geometry, lane) - half, top, half * 2, geometry.hitY - top + half, half);
};

/** Puts the parts in place for a layout. The glows and the mask are drawn here, never in a frame. */
const dress = (parts: Parts, geometry: Geometry, textures: Textures): void => {
  const { backdrop, mask } = parts;
  parts.app.renderer.resize(geometry.width, geometry.height);
  backdrop.texture = textures.stage;
  mask.clear();
  parts.band.forEach((lane, at) => {
    chute(parts.glows[at]?.clear() ?? new Graphics(), geometry, lane).fill(hex(TOKENS.lemon));
    chute(mask, geometry, lane).fill(0xff_ff_ff);
    parts.rings[at]?.dress(textures, geometry.ringR);
    parts.rings[at]?.container.position.set(laneX(geometry, lane), geometry.hitY);
  });
  dressEnergy(parts.energy, geometry, textures);
};

const drawBeat = ({ parts, view, scene }: Frame, at: number): void => {
  const beat = view.beats[at];
  const { geometry } = scene;
  const y = noteY(geometry, (beat?.t ?? 0) - view.t);
  if (beat === undefined || y < geometry.topY + 8 || y > geometry.hitY - geometry.ringD / 2 - 6) {
    return;
  }
  // A pill fades in over the top 35% of the highway.
  const alpha = clamp01((y - geometry.topY) / ((geometry.hitY - geometry.topY) * 0.35));
  for (const lane of parts.band) {
    const texture = scene.textures.shape(shapeKey.pill(lane, beat.downbeat));
    parts.pills.show(texture, { x: laneX(geometry, lane), y, alpha });
  }
};

const drawLanes = ({ parts, view, scene }: Frame): void => {
  parts.band.forEach((lane, at) => {
    const state = view.lanes[lane];
    const glow = parts.glows[at];
    parts.rings[at]?.update(state, scene.reduced);
    if (glow) {
      glow.alpha = state.hitAge < GLOW_SEC ? (1 - state.hitAge / GLOW_SEC) * GLOW_ALPHA : 0;
    }
  });
};

const drawFrame = (frame: Frame): void => {
  const { parts, view } = frame;
  drawLanes(frame);
  parts.pills.begin();
  for (let at = view.first.beat; (view.beats[at]?.t ?? Number.POSITIVE_INFINITY) <= view.t + LOOK_AHEAD; at += 1) {
    drawBeat(frame, at);
  }
  parts.pills.end();
  drawNotes({ notes: parts.notes, links: parts.links, view, scene: frame.scene });
  parts.effects.begin();
  for (let at = view.first.hit; at < view.hits.length; at += 1) {
    drawHit(frame.scene, view.hits[at]);
  }
  parts.effects.end();
  drawEnergy(parts.energy, { ...frame.scene, energy: frame.energy, beats: view.beats, beat: view.first.beat });
  parts.app.render();
};

const makeParts = (app: Application, band: readonly Lane[]): Parts => {
  const layer = (): Container => app.stage.addChild(new Container());
  const backdrop = app.stage.addChild(new Sprite());
  const energyBack = layer();
  const glowLayer = layer();
  const glows = band.map(() => glowLayer.addChild(new Graphics()));
  const pills = makePool(layer());
  const rings = band.map((lane) => makeRing(lane));
  for (const ring of rings) {
    app.stage.addChild(ring.container);
  }
  const rims = layer();
  // Notes come out of the chutes: one mask of the chute shapes clips them.
  const noteLayer = layer();
  const mask = app.stage.addChild(new Graphics());
  noteLayer.mask = mask;
  // The jelly band of a double crosses between the chutes, so it is not clipped.
  const links = makePool(layer());
  const effects = makePool(layer());
  const energy = makeEnergyParts({ back: energyBack, rims, front: layer() }, band);
  return { app, band, backdrop, glows, mask, rings, pills, notes: makePool(noteLayer), links, effects, energy };
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
  const parts = makeParts(app, band);
  let layout = { geometry, textures: makeTextures(geometry, band, RESOLUTION) };
  dress(parts, layout.geometry, layout.textures);
  return {
    resize: (next) => {
      const old = layout.textures;
      layout = { geometry: next, textures: makeTextures(next, band, RESOLUTION) };
      dress(parts, layout.geometry, layout.textures);
      old.destroy();
    },
    draw: (view, reduced, energy) => {
      const scene: EffectScene = { pool: parts.effects, ...layout, reduced, t: view.t };
      drawFrame({ parts, view, energy, scene });
    },
    destroy: () => {
      app.destroy({ removeView: false }, { children: true });
      layout.textures.destroy();
    },
  };
};
