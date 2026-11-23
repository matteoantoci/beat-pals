// The atlas shapes of the soft holds and the doubles (see ./paint-holds): the held head, the star bead, the band
// strip, its cap and its dots, falling and held, for each lane, and the jelly band of each pair of adjacent lanes.

import {
  BAND_HALO,
  BAND_STRIP,
  paintBandCap,
  paintBandDot,
  paintBandStrip,
  paintBead,
  paintHeldBubble,
  paintLink,
} from './paint-holds';
import type { Lane } from '../../model';
import type { Geometry } from './geometry';
import type { Ctx } from './paint';

type Shape = { readonly key: string; readonly w: number; readonly h: number; readonly paint: (ctx: Ctx) => void };

const square = (key: string, size: number, paint: (ctx: Ctx) => void): Shape => ({ key, w: size, h: size, paint });

/** The keys of the shapes of the holds and the doubles. */
export const holdKey = {
  heldBubble: (lane: Lane): string => `held bubble ${String(lane)}`,
  /** The hold band: a strip that the sprite stretches, its round top, and its light dots. */
  bandStrip: (lane: Lane, held: boolean): string => `band strip ${String(lane)} ${held ? 'held' : 'falling'}`,
  bandCap: (lane: Lane, held: boolean): string => `band cap ${String(lane)} ${held ? 'held' : 'falling'}`,
  bandDot: (lane: Lane, held: boolean): string => `band dot ${String(lane)} ${held ? 'held' : 'falling'}`,
  bead: (lane: Lane): string => `bead ${String(lane)}`,
  /** The jelly band of a double from `left` to the lane on its right. */
  link: (left: Lane): string => `link ${String(left)}`,
  popStar: 'pop star',
} as const;

/** The share of the note size that is the half width of a hold band. */
export const BAND_SHARE = 0.28;
/** The share of the note size that is the radius of a star bead. */
const BEAD_SHARE = 0.24;
/** The share of the note size that is the radius of the star that pops when a hold is done. */
export const POP_SHARE = 0.26;

export const holdShapes = (geometry: Geometry, lane: Lane): Shape[] => {
  const half = geometry.noteS * BAND_SHARE;
  const wide = 2 * (half + BAND_HALO) + 2;
  const bead = geometry.noteS * BEAD_SHARE;
  return [
    square(holdKey.heldBubble(lane), Math.ceil(geometry.noteS * 1.45 + 4), (ctx) =>
      paintHeldBubble(ctx, lane, geometry.noteS)
    ),
    square(holdKey.bead(lane), 2 * bead * 1.12 + 8, (ctx) => paintBead(ctx, lane, bead)),
    ...[false, true].flatMap((held) => [
      {
        key: holdKey.bandStrip(lane, held),
        w: wide,
        h: BAND_STRIP,
        paint: (ctx: Ctx) => paintBandStrip(ctx, { lane, half, held }),
      },
      square(holdKey.bandCap(lane, held), wide, (ctx) => paintBandCap(ctx, { lane, half, held })),
      square(holdKey.bandDot(lane, held), 8, (ctx) => paintBandDot(ctx, lane, held)),
    ]),
  ];
};

export const linkShapes = (geometry: Geometry): Shape[] => {
  const h = geometry.noteS * 0.5;
  return ([0, 1] as const).map((left) => ({
    key: holdKey.link(left),
    w: geometry.laneW + h + 4,
    h: h + 12,
    paint: (ctx: Ctx) => paintLink(ctx, [left, left === 0 ? 1 : 2], { length: geometry.laneW, noteS: geometry.noteS }),
  }));
};
