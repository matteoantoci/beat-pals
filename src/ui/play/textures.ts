// The textures of one layout: the still stage as one picture, and the atlas of the moving shapes (C20). A new
// layout (a turn of the device) paints them again and frees the old ones.

import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { paintAtlas } from './atlas';
import { paintStage } from './paint-stage';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';

export type Textures = {
  /** The still stage, as large as the screen. */
  readonly stage: Texture;
  /** The texture of an atlas shape. See `shapeKey` in ./atlas. */
  readonly shape: (key: string) => Texture;
  readonly destroy: () => void;
};

const stageSource = (geometry: Geometry, band: readonly Lane[], resolution: number): CanvasSource => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(geometry.width * resolution);
  canvas.height = Math.ceil(geometry.height * resolution);
  const ctx = canvas.getContext('2d');
  ctx?.scale(resolution, resolution);
  if (ctx !== null) {
    paintStage(ctx, geometry, band);
  }
  return new CanvasSource({ resource: canvas, resolution, width: geometry.width, height: geometry.height });
};

export const makeTextures = (geometry: Geometry, band: readonly Lane[], resolution: number): Textures => {
  const stage = new Texture({ source: stageSource(geometry, band, resolution) });
  const atlas = paintAtlas(geometry, band, resolution);
  const source = new CanvasSource({
    resource: atlas.canvas,
    resolution,
    width: atlas.canvas.width / resolution,
    height: atlas.canvas.height / resolution,
  });
  const shapes = new Map(
    [...atlas.frames].map(([key, { x, y, w, h }]) => [key, new Texture({ source, frame: new Rectangle(x, y, w, h) })])
  );
  return {
    stage,
    shape: (key) => shapes.get(key) ?? Texture.EMPTY,
    destroy: () => {
      stage.destroy(true);
      for (const texture of shapes.values()) {
        texture.destroy();
      }
      source.destroy();
    },
  };
};
