// The pals of the play screen: HTML pictures above the PixiJS canvas (ADR 0002). They move only by CSS transforms
// (C21); their poses are in ./pal-poses. A waiting pal (not in the band yet) stands right next to the band, at the
// same size. It smiles while the band hits, and it hops 8 px at a tap in its column. A frame writes the DOM only on a
// change, and builds a transform string only then (C20).

import { palPicture } from '../pals/pal-svg';
import { laneX } from './geometry';
import { bandPose, beat, cheerPose, idlePose, pose, waitingPose } from './pal-poses';
import type { Lane, SongFacts } from '../../model';
import type { EnergyLook } from './energy';
import type { Geometry } from './geometry';
import type { View } from './view';

/** The gap between a waiting pal and the edge lane of the band. */
const WAIT_GAP = 8;

export type Pals = {
  readonly layout: (geometry: Geometry) => void;
  readonly update: (view: View, reduced: boolean, energy: EnergyLook) => void;
  /** A tap in the column of a waiting pal at song time `t`: the pal hops. */
  readonly hop: (lane: Lane, t: number) => void;
};

/** The x of the middle of a pal: under its ring in the band, else right next to the band on its side. */
export const palX = (geometry: Geometry, band: readonly Lane[], lane: Lane): number => {
  if (band.includes(lane)) {
    return laneX(geometry, lane);
  }
  // The band lists its lanes from left to right.
  const step = geometry.palH + WAIT_GAP;
  const low = band[0] ?? lane;
  return lane < low ? laneX(geometry, low) - step : laneX(geometry, band.at(-1) ?? lane) + step;
};

/** True for each beat that is strong: a downbeat, or the second beat after it. */
const strongBeats = (beats: SongFacts['beats']): boolean[] => {
  let sinceDownbeat = 0;
  return beats.map((each) => {
    sinceDownbeat = each.downbeat ? 0 : sinceDownbeat + 1;
    return sinceDownbeat % 2 === 0;
  });
};

/** The index of the last beat at or before the frame time. */
const beatNow = (view: View): number => {
  let at = view.first.beat;
  while (at > 0 && (view.beats[at]?.t ?? Number.POSITIVE_INFINITY) > view.t) {
    at -= 1;
  }
  while ((view.beats[at + 1]?.t ?? Number.POSITIVE_INFINITY) <= view.t) {
    at += 1;
  }
  return at;
};

/** The share of the beat `at` that passed at the frame time (0 before the first beat). */
const beatPhase = (view: View, at: number): number => {
  const start = view.beats[at]?.t ?? Number.POSITIVE_INFINITY;
  const phase = (view.t - start) / ((view.beats[at + 1]?.t ?? Number.POSITIVE_INFINITY) - start);
  return phase >= 0 && phase < 1 ? phase : 0;
};

/** The name of the pal of each picture, by lane, for tests that need one pal. */
const PAL_NAMES = ['pip', 'dot', 'bo'] as const;

/** Sizes every pal picture at the pal size: the band and the waiting pals. A picture shows at its first placement,
 * not here: the layout comes during the load, and a picture with no source and no place is an empty box at the top
 * left corner. */
const sizeAll = (images: readonly HTMLImageElement[], size: number): void => {
  for (const [lane, image] of images.entries()) {
    image.dataset['pal'] = PAL_NAMES[lane];
    image.style.width = `${String(size)}px`;
    image.style.height = `${String(size)}px`;
  }
};

/** The transform of a pal picture: its top left corner, its lean, and its squash. */
type Placed = { x: number; y: number; rot: number; sx: number; sy: number };

/** The CSS transform, at the precision that `same` compares. */
const transformOf = (at: Placed): string =>
  `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) rotate(${at.rot.toFixed(2)}deg) ` +
  `scale(${at.sx.toFixed(3)}, ${at.sy.toFixed(3)})`;

/** True when 2 transforms give the same CSS string. */
const same = (a: Placed, b: Placed): boolean =>
  Math.round(a.x * 10) === Math.round(b.x * 10) &&
  Math.round(a.y * 10) === Math.round(b.y * 10) &&
  Math.round(a.rot * 100) === Math.round(b.rot * 100) &&
  Math.round(a.sx * 1000) === Math.round(b.sx * 1000) &&
  Math.round(a.sy * 1000) === Math.round(b.sy * 1000);

/** The pal picture of a lane: it shows `pose` with its feet on the floor, and writes the DOM only on a change. */
const makePlacer = (images: readonly HTMLImageElement[], band: readonly Lane[]) => {
  const shown = images.map(() => ({ src: '', x: Number.NaN, y: 0, rot: 0, sx: 1, sy: 1 }));
  const next: Placed = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 };
  return (geometry: Geometry, lane: Lane): void => {
    const image = images[lane];
    const last = shown[lane];
    if (image === undefined || last === undefined) {
      return;
    }
    const src = palPicture(lane, pose.state);
    next.x = palX(geometry, band, lane) + pose.dx - geometry.palH / 2;
    next.y = geometry.floorY - geometry.palH + pose.ty;
    next.rot = pose.rot;
    next.sx = pose.sx;
    next.sy = pose.sy;
    if (src !== last.src) {
      image.src = src;
      image.hidden = false;
      last.src = src;
    }
    if (!same(next, last)) {
      image.style.transform = transformOf(next);
      Object.assign(last, next);
    }
  };
};

export const makePals = (
  images: readonly HTMLImageElement[],
  band: readonly Lane[],
  beats: SongFacts['beats']
): Pals => {
  const strong = strongBeats(beats);
  /** The song time of the last hop of each pal. */
  const hops = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const waiting = ([0, 1, 2] as const).filter((lane) => !band.includes(lane));
  const place = makePlacer(images, band);
  let geometry: Geometry | undefined;
  const update = (view: View, reduced: boolean, energy: EnergyLook): void => {
    const at = geometry;
    if (at === undefined) {
      return;
    }
    const now = beatNow(view);
    beat.phase = beatPhase(view, now);
    beat.strong = strong[now] === true;
    const cheerAge = view.t - (view.stars.at(-1) ?? Number.NEGATIVE_INFINITY);
    let bandHitAge = Number.POSITIVE_INFINITY;
    for (const lane of band) {
      idlePose(lane, energy, reduced);
      bandPose(view.lanes[lane], reduced);
      cheerPose(lane, cheerAge, reduced);
      place(at, lane);
      bandHitAge = Math.min(bandHitAge, view.lanes[lane].hitAge);
    }
    for (const lane of waiting) {
      waitingPose(view.t - (hops[lane] ?? Number.NEGATIVE_INFINITY), bandHitAge, reduced);
      cheerPose(lane, cheerAge, reduced);
      place(at, lane);
    }
  };
  return {
    layout: (next) => {
      geometry = next;
      sizeAll(images, next.palH);
    },
    update,
    hop: (lane, t) => {
      hops[lane] = t;
    },
  };
};
