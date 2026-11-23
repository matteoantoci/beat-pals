// What the play screen shows at a song time, from the child chart, the beats of the facts, and the hits so far.
// The play model judges the taps; the view only remembers the hits that it reported, so the screen can remove the
// hit notes and show the effects. Each frame moves the windows forward: no frame looks at the whole song.

import { EFFECT_SEC, makeHit, type HitRecord } from './effects';
import { LOOK_AHEAD } from './geometry';
import { hitNote } from './hits';
import type { ChildChart, Lane, PlayEvent, SongFacts } from '../../model';

/** The ring and the pal of a lane get ready this long before a note. */
const READY_SEC = 0.55;
/** A missed note fades for this long after its time. */
export const MISS_FADE_SEC = 0.3;

type Beat = SongFacts['beats'][number];

/** The state of one lane in a frame. */
export type LaneState = {
  /** From 0 to 1 while the next note of the lane comes near. */
  readonly near: number;
  /** The seconds since the last hit in the lane, or Infinity. */
  readonly hitAge: number;
  readonly great: boolean;
  /** The lean side of the last hit. */
  readonly side: 1 | -1;
};

/** The first note, beat, and hit that can still show. */
type Windows = { readonly note: number; readonly beat: number; readonly hit: number };

/** The view of one frame. */
export type View = {
  readonly chart: ChildChart;
  readonly beats: readonly Beat[];
  /** 1 for each note of the chart that a tap hit. */
  readonly hitNotes: Uint8Array;
  readonly hits: readonly HitRecord[];
  /** Pip, Dot, and Bo. */
  readonly lanes: readonly [LaneState, LaneState, LaneState];
  readonly first: Windows;
  /** The song time of the frame. */
  readonly t: number;
};

/** The view, and the 2 changes that the player makes to it. */
export type LiveView = {
  readonly view: () => View;
  /** Remembers a hit of the play model at the tap time `t`. */
  readonly record: (hit: Extract<PlayEvent, { type: 'hit' }>, t: number) => void;
  /** Moves the view to song time `t`. */
  readonly update: (t: number) => void;
};

const IDLE: LaneState = { near: 0, hitAge: Number.POSITIVE_INFINITY, great: false, side: 1 };

/** The first index from `start` whose time is not before `from`. */
const firstFrom = (times: (at: number) => number | undefined, start: number, from: number): number => {
  let at = start;
  while ((times(at) ?? Number.POSITIVE_INFINITY) < from) {
    at += 1;
  }
  return at;
};

const windowsAt = (view: View, t: number): Windows => ({
  note: firstFrom((at) => view.chart.notes[at]?.t, view.first.note, t - MISS_FADE_SEC),
  beat: firstFrom((at) => view.beats[at]?.t, view.first.beat, t - MISS_FADE_SEC),
  hit: firstFrom((at) => view.hits[at]?.at, view.first.hit, t - EFFECT_SEC),
});

/** True when the note at `at` is a note of the lane that is still to come and not hit. */
const isComing = (view: View, at: number, lane: Lane): boolean => {
  const note = view.chart.notes[at];
  return note !== undefined && note.t > view.t && view.hitNotes[at] === 0 && note.lanes.includes(lane);
};

/** The nearness of the next note of the lane, from 0 to 1. */
const nearness = (view: View, lane: Lane): number => {
  const { notes } = view.chart;
  let at = view.first.note;
  while (at < notes.length && (notes[at]?.t ?? 0) < view.t + READY_SEC && !isComing(view, at, lane)) {
    at += 1;
  }
  const dt = (notes[at]?.t ?? Number.POSITIVE_INFINITY) - view.t;
  return isComing(view, at, lane) && dt < READY_SEC ? 1 - dt / READY_SEC : 0;
};

/** The latest hit of the lane whose effects can still show. A hit after the frame time (the clock after a resume
 * can be a little lower) does not count yet. */
const latestHit = (view: View, lane: Lane): HitRecord | undefined => {
  const counts = (hit: HitRecord | undefined): boolean => hit?.lane === lane && hit.at <= view.t;
  let at = view.hits.length - 1;
  while (at >= view.first.hit && !counts(view.hits[at])) {
    at -= 1;
  }
  return at >= view.first.hit ? view.hits[at] : undefined;
};

const laneState = (view: View, lane: Lane): LaneState => {
  const hit = latestHit(view, lane);
  const near = nearness(view, lane);
  return hit === undefined ? { ...IDLE, near } : { near, hitAge: view.t - hit.at, great: hit.great, side: hit.side };
};

export const makeView = (chart: ChildChart, beats: readonly Beat[]): LiveView => {
  const hitNotes = new Uint8Array(chart.notes.length);
  const hits: HitRecord[] = [];
  let view: View = {
    chart,
    beats,
    hitNotes,
    hits,
    lanes: [IDLE, IDLE, IDLE],
    first: { note: 0, beat: 0, hit: 0 },
    t: 0,
  };
  return {
    view: () => view,
    record: (hit, t) => {
      hitNotes[hitNote(chart, hit)] = 1;
      hits.push(makeHit({ lane: hit.lane, at: t, great: hit.grade === 'great', side: hits.length % 2 === 0 ? 1 : -1 }));
    },
    update: (t) => {
      const moved: View = { ...view, t, first: windowsAt(view, t) };
      view = { ...moved, lanes: [laneState(moved, 0), laneState(moved, 1), laneState(moved, 2)] };
    },
  };
};

/** The latest song time that the highway shows. */
export const lastShown = (t: number): number => t + LOOK_AHEAD + 0.15;
