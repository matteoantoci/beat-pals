// The pals of the play screen: HTML pictures above the PixiJS canvas (ADR 0002). They move only by CSS transforms
// (C21). A hit makes the pal dance: a squash, a jump, and a lean that changes side from hit to hit (P11). The ready
// state with the open mouth starts 0.55 s before the next note of the pal. An idle pal bobs 2 px on the strong
// beats only (C15). With reduced motion, a pal changes its picture and does not move (C16).
// A waiting pal (not in the band yet) stands right next to the band, at the same size. It smiles while the band
// hits, and it hops 8 px at a tap in its column.

import { palPicture, type PalState } from '../pals/pal-svg';
import { laneX } from './geometry';
import type { Lane, SongFacts } from '../../model';
import type { Geometry } from './geometry';
import type { LaneState, View } from './view';

const HAPPY_SEC = 0.5;
/** A waiting pal smiles this long after a hit of the band, and this long after a tap in its column. */
const WAIT_SMILE_SEC = 0.3;
const HOP_SMILE_SEC = 0.4;
/** The hop of a waiting pal. */
const HOP_SEC = 0.3;
const HOP_PX = 8;
/** The gap between a waiting pal and the edge lane of the band. */
const WAIT_GAP = 8;
const SQUASH_SEC = 0.06;

/** One pal picture in one frame: its state and its transform. */
type Pose = {
  readonly state: PalState;
  readonly ty: number;
  readonly rot: number;
  readonly sx: number;
  readonly sy: number;
};

export type Pals = {
  readonly layout: (geometry: Geometry) => void;
  readonly update: (view: View, reduced: boolean) => void;
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
  return beats.map((beat) => {
    sinceDownbeat = beat.downbeat ? 0 : sinceDownbeat + 1;
    return sinceDownbeat % 2 === 0;
  });
};

/** The index of the last beat at or before the frame time. */
const beatNow = (view: View): number => {
  let at = view.first.beat;
  while ((view.beats[at + 1]?.t ?? Number.POSITIVE_INFINITY) <= view.t) {
    at += 1;
  }
  return at;
};

/** The bob of the idle pals: 2 px up in the first half of each strong beat. */
const idleBob = (view: View, strong: readonly boolean[]): number => {
  const at = beatNow(view);
  const start = view.beats[at]?.t ?? Number.POSITIVE_INFINITY;
  const phase = (view.t - start) / ((view.beats[at + 1]?.t ?? Number.POSITIVE_INFINITY) - start);
  return strong[at] === true && phase >= 0 && phase < 0.5 ? -2 * Math.sin(2 * Math.PI * phase) : 0;
};

const STILL = { ty: 0, rot: 0, sx: 1, sy: 1 } as const;

/** The dance after a hit: a squash, then a jump with a lean. */
const happyPose = (lane: LaneState, reduced: boolean): Pose => {
  const h = lane.hitAge;
  if (reduced) {
    return { state: 'happy', ...STILL };
  }
  const after = h - SQUASH_SEC;
  const squash = h < SQUASH_SEC ? -0.16 * (h / SQUASH_SEC) : -0.16 * Math.exp(-after * 9) * Math.cos(after * 22);
  const jump = h < SQUASH_SEC ? 0 : -Math.max(0, Math.sin(after * 8)) * 16 * Math.exp(-after * 4);
  const rot = lane.side * 8 * Math.min(1, h / 0.08) * Math.exp(-h * 3);
  return { state: 'happy', ty: jump, rot, sx: 1 - squash * 0.6, sy: 1 + squash };
};

const poseOf = (lane: LaneState, bob: number, reduced: boolean): Pose => {
  if (lane.hitAge < HAPPY_SEC) {
    return happyPose(lane, reduced);
  }
  if (lane.near > 0) {
    const stretch = reduced ? 0 : lane.near;
    return { state: 'ready', ty: 0, rot: 0, sx: 1 - 0.03 * stretch, sy: 1 + 0.06 * stretch };
  }
  return { state: 'idle', ...STILL, ty: reduced ? 0 : bob };
};

/** A waiting pal: a smile while the band hits, and a hop with a smile after a tap in its column. */
const waitingPose = (hopAge: number, bandHitAge: number, reduced: boolean): Pose => {
  const smile = hopAge < HOP_SMILE_SEC || bandHitAge < WAIT_SMILE_SEC;
  const hops = !reduced && hopAge >= 0 && hopAge < HOP_SEC;
  return {
    state: smile ? 'happy' : 'idle',
    ...STILL,
    ty: hops ? -Math.sin((hopAge / HOP_SEC) * Math.PI) * HOP_PX : 0,
  };
};

/** The CSS transform of a pal: its bottom centre stands on the floor at `centre`. */
const transformOf = (geometry: Geometry, centre: number, pose: Pose): string => {
  const size = geometry.palH;
  const x = (centre - size / 2).toFixed(1);
  const y = (geometry.floorY - size + pose.ty).toFixed(1);
  return `translate(${x}px, ${y}px) rotate(${pose.rot.toFixed(2)}deg) scale(${pose.sx.toFixed(3)}, ${pose.sy.toFixed(3)})`;
};

/** The name of the pal of each picture, by lane, for tests that need one pal. */
const PAL_NAMES = ['pip', 'dot', 'bo'] as const;

/** Shows every pal picture at the pal size: the band and the waiting pals. */
const showAll = (images: readonly HTMLImageElement[], size: number): void => {
  for (const [lane, image] of images.entries()) {
    image.hidden = false;
    image.dataset['pal'] = PAL_NAMES[lane];
    image.style.width = `${String(size)}px`;
    image.style.height = `${String(size)}px`;
  }
};

export const makePals = (
  images: readonly HTMLImageElement[],
  band: readonly Lane[],
  beats: SongFacts['beats']
): Pals => {
  const strong = strongBeats(beats);
  /** What each picture shows, so a frame writes the DOM only on a change. */
  const shown = images.map(() => ({ src: '', transform: '' }));
  /** The song time of the last hop of each pal. */
  const hops = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const waiting = ([0, 1, 2] as const).filter((lane) => !band.includes(lane));
  let geometry: Geometry | undefined;
  const place = (lane: Lane, pose: Pose): void => {
    const image = images[lane];
    const last = shown[lane];
    if (image === undefined || last === undefined || geometry === undefined) {
      return;
    }
    const src = palPicture(lane, pose.state);
    const transform = transformOf(geometry, palX(geometry, band, lane), pose);
    if (src !== last.src) {
      image.src = src;
      last.src = src;
    }
    if (transform !== last.transform) {
      image.style.transform = transform;
      last.transform = transform;
    }
  };
  return {
    layout: (next) => {
      geometry = next;
      showAll(images, next.palH);
    },
    update: (view, reduced) => {
      const bob = idleBob(view, strong);
      for (const lane of band) {
        place(lane, poseOf(view.lanes[lane], bob, reduced));
      }
      const bandHitAge = Math.min(...band.map((lane) => view.lanes[lane].hitAge));
      for (const lane of waiting) {
        place(lane, waitingPose(view.t - (hops[lane] ?? Number.NEGATIVE_INFINITY), bandHitAge, reduced));
      }
    },
    hop: (lane, t) => {
      hops[lane] = t;
    },
  };
};
