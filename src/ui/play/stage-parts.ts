// The parts of the PixiJS play stage (see ./stage): the layers, the pools, the ring and the chute glow of each lane,
// and the one mask of the chutes. A new layout dresses them; the glows and the mask are drawn then, never in a frame.

import { Container, Graphics, Sprite, type Application } from 'pixi.js';
import { hex, LANE_COLORS } from '../pals/color';
import { dressEnergy, makeEnergyParts, type EnergyParts } from './energy-stage';
import { laneX } from './geometry';
import { CHUTE_SHARE } from './paint-stage';
import { makePool, type Pool } from './pool';
import { makeRing, type Ring } from './rings';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';
import type { Textures } from './textures';

/** The ring and the chute glow of one lane of the band. */
type LanePart = { readonly lane: Lane; readonly ring: Ring; readonly glow: Graphics };

export type Parts = {
  readonly app: Application;
  readonly band: readonly Lane[];
  readonly backdrop: Sprite;
  readonly lanes: readonly LanePart[];
  readonly mask: Graphics;
  readonly pills: Pool;
  readonly notes: Pool;
  /** The parts that cross between the chutes or sit on the rings: doubles, held heads, and popped beads. */
  readonly links: Pool;
  readonly effects: Pool;
  readonly energy: EnergyParts;
};

/** The chute shape of a lane as a Graphics path, for the glow and the note mask. */
const chute = (graphics: Graphics, geometry: Geometry, lane: Lane): Graphics => {
  const half = geometry.laneW * CHUTE_SHARE;
  const top = geometry.chuteTop;
  return graphics.roundRect(laneX(geometry, lane) - half, top, half * 2, geometry.hitY - top + half, half);
};

/** Puts the parts in place for a layout. The glows and the mask are drawn here, never in a frame. */
export const dress = (parts: Parts, geometry: Geometry, textures: Textures): void => {
  const { backdrop, mask } = parts;
  parts.app.renderer.resize(geometry.width, geometry.height);
  backdrop.texture = textures.stage;
  mask.clear();
  for (const { lane, ring, glow } of parts.lanes) {
    chute(glow.clear(), geometry, lane).fill(hex(LANE_COLORS[lane].base));
    chute(mask, geometry, lane).fill(0xff_ff_ff);
    ring.dress(textures, geometry.ringR);
    ring.container.position.set(laneX(geometry, lane), geometry.hitY);
  }
  dressEnergy(parts.energy, geometry, textures);
};

export const makeParts = (app: Application, band: readonly Lane[]): Parts => {
  const layer = (): Container => app.stage.addChild(new Container());
  const backdrop = app.stage.addChild(new Sprite());
  const energyBack = layer();
  const glowLayer = layer();
  const glows = band.map(() => glowLayer.addChild(new Graphics()));
  const pills = makePool(layer());
  const lanes = band.map((lane, at) => {
    const ring = makeRing(lane);
    app.stage.addChild(ring.container);
    return { lane, ring, glow: glows[at] ?? new Graphics() };
  });
  const rims = layer();
  // Notes come out of the chutes: one mask of the chute shapes clips them.
  const noteLayer = layer();
  const mask = app.stage.addChild(new Graphics());
  noteLayer.mask = mask;
  // The jelly band of a double crosses between the chutes, so it is not clipped.
  const links = makePool(layer());
  const effects = makePool(layer());
  const energy = makeEnergyParts({ back: energyBack, rims, front: layer() }, band);
  return { app, band, backdrop, lanes, mask, pills, notes: makePool(noteLayer), links, effects, energy };
};
