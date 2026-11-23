// A pool of sprites in one container (C20: object pools, no allocation in the game loop once the pool is warm).
// Each frame takes sprites from the start of the pool, and `end` hides the sprites that the frame did not take.
// `show` gives the sprite itself, so a frame makes no look object for each sprite.

import { Sprite, type Container, type Texture } from 'pixi.js';

export type Pool = {
  /**
   * Shows one more sprite with this texture and `alpha`, at scale 1 with no rotation. It gives the sprite: the caller
   * sets its position, and its scale and rotation when they are not the default.
   */
  readonly show: (texture: Texture, alpha: number) => Sprite;
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
    show: (texture, alpha) => {
      const sprite = take();
      used += 1;
      sprite.texture = texture;
      sprite.visible = alpha > 0;
      sprite.alpha = alpha;
      sprite.scale.set(1);
      sprite.rotation = 0;
      return sprite;
    },
    begin: () => {
      used = 0;
    },
    end: () => {
      let at = 0;
      for (const sprite of sprites) {
        sprite.visible &&= at < used;
        at += 1;
      }
    },
  };
};
