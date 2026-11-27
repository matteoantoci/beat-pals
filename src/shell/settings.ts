// The Sound effects switch of the parent area in the device storage. It is not game data, so a reset of the game
// keeps it.

import type { Codec } from './storage/slot';

/** The Sound effects switch (the claps, the level-up sounds, the end scene sounds, and the sounds of the session
 * scenes): true (on) when there is no setting or the storage is blocked. The songs and the title music always play.
 * The stored text is "off" when the parent turned the sound effects off. */
export const soundCodec: Codec<boolean> = {
  absent: true,
  decode: (text) => text !== 'off',
  encode: (on) => (on ? 'on' : 'off'),
};
