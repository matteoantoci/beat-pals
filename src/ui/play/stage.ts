// The PixiJS play screen (spec, "Screens": play screen; ADR 0002). It draws the still stage, the beat pills, the
// rings, the notes, and the hit effects; the pals are HTML pictures above it. Rules of C20: one texture atlas, sprite
// pools, no Graphics drawn again in a frame, no filters, one mask, and resolution 2 at most with autoDensity.

import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { hex, TOKENS } from '../pals/color';
import { shapeKey } from './atlas';
import { drawHit, type EffectScene } from './effects';
import { laneX, LOOK_AHEAD, noteY } from './geometry';
import { CHUTE_SHARE } from './paint-stage';
import { makePool, type Pool } from './pool';
import { makeRing, type Ring } from './rings';
import { makeTextures, type Textures } from './textures';
import { lastShown, MISS_FADE_SEC, type View } from './view';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';

export type Stage = {
  /** Paints the stage again for a new screen size. */
  readonly resize: (geometry: Geometry) => void;
  /** Draws the view at its song time. */
  readonly draw: (view: View, reduced: boolean) => void;
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
  readonly effects: Pool;
};

/** One frame: the parts, the view, and what the effects need. */
type Frame = { readonly parts: Parts; readonly view: View; readonly scene: EffectScene };

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

const drawNote = ({ parts, view, scene }: Frame, at: number): void => {
  const note = view.chart.notes[at];
  const dt = (note?.t ?? 0) - view.t;
  if (note === undefined || view.hitNotes[at] === 1 || dt < -MISS_FADE_SEC) {
    return;
  }
  const [lane] = note.lanes;
  const y = noteY(scene.geometry, dt);
  // A note fades in at the top, and a missed note fades out below its ring.
  const alpha = clamp01(Math.min((y - scene.geometry.topY + 20) / 60, dt < 0 ? 1 + dt / MISS_FADE_SEC : 1));
  parts.notes.show(scene.textures.shape(shapeKey.bubble(lane)), { x: laneX(scene.geometry, lane), y, alpha });
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
  parts.notes.begin();
  for (let at = view.first.note; (view.chart.notes[at]?.t ?? Number.POSITIVE_INFINITY) < lastShown(view.t); at += 1) {
    drawNote(frame, at);
  }
  parts.notes.end();
  parts.effects.begin();
  for (let at = view.first.hit; at < view.hits.length; at += 1) {
    drawHit(frame.scene, view.hits[at]);
  }
  parts.effects.end();
  parts.app.render();
};

const makeParts = (app: Application, band: readonly Lane[]): Parts => {
  const layer = (): Container => app.stage.addChild(new Container());
  const backdrop = app.stage.addChild(new Sprite());
  const glowLayer = layer();
  const glows = band.map(() => glowLayer.addChild(new Graphics()));
  const pills = makePool(layer());
  const rings = band.map((lane) => makeRing(lane));
  for (const ring of rings) {
    app.stage.addChild(ring.container);
  }
  // Notes come out of the chutes: one mask of the chute shapes clips them.
  const noteLayer = layer();
  const mask = app.stage.addChild(new Graphics());
  noteLayer.mask = mask;
  return { app, band, backdrop, glows, mask, rings, pills, notes: makePool(noteLayer), effects: makePool(layer()) };
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
    draw: (view, reduced) => {
      const scene: EffectScene = { pool: parts.effects, ...layout, reduced, t: view.t };
      drawFrame({ parts, view, scene });
    },
    destroy: () => {
      app.destroy({ removeView: false }, { children: true });
      layout.textures.destroy();
    },
  };
};
