// The layout of the play screen (spec, "Screens": play screen layout), the numbers of prototype play-style A on
// the 4 px scale. The highway is flat: a note falls at one speed from the top to its ring, and the look-ahead is
// 2.0 s in both orientations. The 3 lanes never move: Pip left, Dot in the middle, Bo right.

import { LOOK_AHEAD, type Lane } from '../../model';

/** The safe-area insets of the screen, in CSS px. */
export type Insets = { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };

export type Geometry = {
  readonly width: number;
  readonly height: number;
  readonly portrait: boolean;
  /** The x of the middle of Dot's lane. */
  readonly cx: number;
  readonly laneW: number;
  /** The height of a pal picture. */
  readonly palH: number;
  readonly ringR: number;
  /** The outer edge of a ring, as a diameter. */
  readonly ringD: number;
  /** The size of a note. */
  readonly noteS: number;
  /** The y where the pals stand. */
  readonly floorY: number;
  /** The y of the ring centres: a note reaches it at its time. */
  readonly hitY: number;
  /** The y where a note enters, LOOK_AHEAD before its time. */
  readonly topY: number;
  /** The top of a chute: above the screen in landscape. */
  readonly chuteTop: number;
  /** Pixels for each second of song time. */
  readonly speed: number;
};

/** `ringEdge` is the outer radius of a ring and `noteS` the size of a note, both on the 4 px scale (C22). */
const PORTRAIT = { palH: 104, ringEdge: 40, noteS: 60, topGap: 72, minLane: 124, maxLane: 148 } as const;
const LANDSCAPE = { palH: 72, ringEdge: 32, noteS: 48, topGap: 12, laneW: 140 } as const;
const FLOOR_GAP = 16;
/** The centre line of the 6 px outer band of a ring lies half its width inside the outer edge. */
const HALF_BAND = 3;
/** In landscape, the chutes start above the screen, so they run off the top edge. */
const LANDSCAPE_CHUTE_TOP = -80;

/** The lane width in portrait: about 2 cm on an iPhone 12, snapped to the 4 px scale. */
const portraitLane = (room: number): number =>
  Math.max(PORTRAIT.minLane, Math.min(PORTRAIT.maxLane, Math.floor((room - 12) / 12) * 4));

export const layout = (width: number, height: number, insets: Insets): Geometry => {
  const portrait = height >= width;
  const room = width - insets.left - insets.right;
  const size = portrait ? PORTRAIT : LANDSCAPE;
  const { palH, ringEdge } = size;
  const floorY = height - insets.bottom - FLOOR_GAP;
  // The pal stands right under its ring and touches it.
  const hitY = floorY - palH - ringEdge + 16;
  const topY = insets.top + (portrait ? PORTRAIT.topGap : LANDSCAPE.topGap);
  return {
    width,
    height,
    portrait,
    cx: insets.left + room / 2,
    laneW: portrait ? portraitLane(room) : LANDSCAPE.laneW,
    palH,
    ringR: ringEdge - HALF_BAND,
    ringD: 2 * ringEdge,
    noteS: size.noteS,
    floorY,
    hitY,
    topY,
    chuteTop: portrait ? topY - 16 : LANDSCAPE_CHUTE_TOP,
    speed: (hitY - topY) / LOOK_AHEAD,
  };
};

/** The x of the middle of a lane. */
export const laneX = (geometry: Geometry, lane: Lane): number => geometry.cx + (lane - 1) * geometry.laneW;

/**
 * The lane of a tap at `x` (spec, "Play rules"). The 3 columns run over the full height of the screen: Dot's column
 * is its drawn lane, Pip's column runs from the left screen edge to Dot's lane, and Bo's column from Dot's lane to
 * the right screen edge.
 */
export const laneAt = (geometry: Geometry, x: number): Lane => {
  const half = geometry.laneW / 2;
  if (x < geometry.cx - half) {
    return 0;
  }
  return x > geometry.cx + half ? 2 : 1;
};

/** The y of a note `dt` seconds before its time. */
export const noteY = (geometry: Geometry, dt: number): number => geometry.hitY - dt * geometry.speed;

/** The value, held from 0 to 1. */
export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
