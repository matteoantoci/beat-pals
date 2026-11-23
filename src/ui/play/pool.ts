// A pool of sprites in one container (C20: object pools, no allocation in the game loop once the pool is warm).
// Each frame takes sprites from the start of the pool, and `end` hides the sprites that the frame did not take.

import { Sprite, type Container, type Texture } from 'pixi.js';

/** The look of one sprite in one frame. */
type Look = {
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
  readonly scale?: number;
  /** The vertical scale, when it differs from `scale` (a stretched strip). */
  readonly scaleY?: number;
  readonly rotation?: number;
};

export type Pool = {
  /** Shows one more sprite with this texture and look. */
  readonly show: (texture: Texture, look: Look) => void;
  /** Starts a frame. */
  readonly begin: () => void;
  /** Hides the sprites that this frame did not show. */
  readonly end: () => void;
};

export const makePool = (parent: Container): Pool => {
  const sprites: Sprite[] = [];
  let used = 0;
  const take = (): Sprite => {
    const known = sprites[used];
    if (known) {
      return known;
    }
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    sprites.push(sprite);
    parent.addChild(sprite);
    return sprite;
  };
  return {
    show: (texture, look) => {
      const sprite = take();
      used += 1;
      sprite.texture = texture;
      sprite.visible = look.alpha > 0;
      sprite.alpha = look.alpha;
      sprite.position.set(look.x, look.y);
      sprite.scale.set(look.scale ?? 1, look.scaleY ?? look.scale ?? 1);
      sprite.rotation = look.rotation ?? 0;
    },
    begin: () => {
      used = 0;
    },
    end: () => {
      let at = 0;
      for (const sprite of sprites) {
        sprite.visible = sprite.visible && at < used;
        at += 1;
      }
    },
  };
};
