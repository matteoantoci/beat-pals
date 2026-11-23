// The ring of a lane (prototype play-style A, `drawRing`): round, in the lane colour, with 4 studs, a double band,
// and the pal mark. When a note comes near, the bands turn to the light colour, the studs turn white, and a soft
// halo grows. A hit pops the ring (1 to 1.15 to 1 in 150 ms), fills it softly in the lane colour, and a great hit
// adds a small white core. The layers are sprites of the atlas: a frame only fades and scales them.

import { Container, Sprite } from 'pixi.js';
import { shapeKey } from './atlas';
import { HALO_GAP } from './paint-fx';
import type { Lane } from '../../model';
import type { Textures } from './textures';

/** The state of a ring in one frame. */
type RingState = {
  /** From 0 to 1 while the next note comes near. */
  near: number;
  /** The seconds since the last hit in the lane, or Infinity. */
  hitAge: number;
  great: boolean;
};

const POP_SEC = 0.15;
const FILL_SEC = 0.35;
const CORE_SEC = 0.12;

export type Ring = {
  readonly container: Container;
  /** Takes the textures of a new layout. */
  readonly dress: (textures: Textures, ringR: number) => void;
  readonly update: (state: RingState, reduced: boolean) => void;
};

/** The layers from the bottom up. */
const LAYERS = ['floor', 'fill', 'core', 'halo', 'bands', 'near', 'studs', 'white'] as const;
type LayerName = (typeof LAYERS)[number];

/** The atlas shape of each layer. */
const LAYER_SHAPES: Readonly<Record<LayerName, (lane: Lane) => string>> = {
  floor: shapeKey.ringFloor,
  fill: shapeKey.ringHit,
  core: () => shapeKey.core,
  halo: shapeKey.ringHalo,
  bands: shapeKey.ringBands,
  near: shapeKey.ringNear,
  studs: shapeKey.studs,
  white: () => shapeKey.whiteStuds,
};

/** The alpha of the soft hit fill: full for 0.1 s, then a fade to 0.35 s. */
const fillAlpha = (age: number): number => {
  if (age >= FILL_SEC) {
    return 0;
  }
  return 0.3 * (age < 0.1 ? 1 : 1 - (age - 0.1) / (FILL_SEC - 0.1));
};

export const makeRing = (lane: Lane): Ring => {
  const container = new Container();
  const layers = new Map(
    LAYERS.map((name) => {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      container.addChild(sprite);
      return [name, sprite] as const;
    })
  );
  const sprite = (name: LayerName): Sprite => layers.get(name) ?? new Sprite();
  const fill = sprite('fill');
  const core = sprite('core');
  const halo = sprite('halo');
  const near = sprite('near');
  const studs = sprite('studs');
  const white = sprite('white');
  let ringR = 1;
  return {
    container,
    dress: (textures, r) => {
      ringR = r;
      for (const name of LAYERS) {
        sprite(name).texture = textures.shape(LAYER_SHAPES[name](lane));
      }
    },
    update: ({ near: nearness, hitAge, great }, reduced) => {
      container.scale.set(!reduced && hitAge < POP_SEC ? 1 + 0.15 * Math.sin((hitAge / POP_SEC) * Math.PI) : 1);
      fill.alpha = fillAlpha(hitAge);
      core.alpha = great && hitAge < CORE_SEC ? 1 - hitAge / CORE_SEC : 0;
      halo.alpha = 0.45 * nearness;
      halo.scale.set((ringR + 9 + 3 * nearness) / (ringR + HALO_GAP));
      near.alpha = nearness;
      white.visible = nearness > 0.5;
      studs.visible = !white.visible;
    },
  };
};
