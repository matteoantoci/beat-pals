// What the play screen shows at a song time, from the child chart, the beats of the facts, and the hits so far.
// The play model judges the taps; the view only remembers the hits that it reported, so the screen can remove the
// hit notes and show the effects. Each frame moves the windows forward: no frame looks at the whole song.
// The view is one object that each frame fills in, so a frame makes no object (C20).

import { LOOK_AHEAD, type Action, type ChildChart, type Lane, type PlayEvent, type SongFacts } from '../../model';
import { EFFECT_SEC, makeHit, type HitRecord } from './effects';
import { makeHolds } from './held';
import { doneAge, isHeld, latestHit, nearness } from './view-lanes';

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
  /** The lean side of the last hit. After a double hit, the side of the partner lane. */
  readonly side: 1 | -1;
  /** True when the last hit was a double: the 2 pals lean toward each other and clap. */
  readonly clap: boolean;
  /** True while a finger holds a soft hold of the lane. */
  readonly held: boolean;
  /** The seconds since the last soft hold of the lane was done, or Infinity. */
  readonly doneAge: number;
};

/** A soft hold that is done: its note and the song time. */
type HoldDone = { readonly note: number; readonly at: number };

/** The first note, beat, and hit that can still show. */
type Windows = { readonly note: number; readonly beat: number; readonly hit: number };

/** The view of one frame. */
export type View = {
  readonly chart: ChildChart;
  readonly beats: readonly Beat[];
  /** 1 for each note of the chart that a tap hit. */
  readonly hitNotes: Uint8Array;
  /** The `HOLD` state of each note of the chart. */
  readonly holds: Uint8Array;
  /** The soft holds that are done, in time order. */
  readonly dones: readonly HoldDone[];
  readonly hits: readonly HitRecord[];
  /** Pip, Dot, and Bo. */
  readonly lanes: readonly [LaneState, LaneState, LaneState];
  readonly first: Windows;
  /** The song time of the frame. */
  readonly t: number;
};

/** The view, and the 2 changes that the play loop makes to it. */
export type LiveView = {
  /** The view. It is the same object at each call: `update` changes it. */
  readonly view: () => View;
  /**
   * Follows an action and its events at song time `t`: it remembers each hit (and the soft hold that the pointer of
   * the press holds), lets go of the soft hold of a released pointer, and remembers each done hold.
   */
  readonly track: (action: Action, events: readonly PlayEvent[], t: number) => void;
  /** Moves the view to song time `t`. */
  readonly update: (t: number) => void;
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const idle = (): Mutable<LaneState> => ({
  near: 0,
  hitAge: Number.POSITIVE_INFINITY,
  great: false,
  side: 1,
  clap: false,
  held: false,
  doneAge: Number.POSITIVE_INFINITY,
});

/** The time until which the note at `at` shows: a soft hold shows to its end. Holds end before the next note, so the
 * end times stay in order. */
const noteEnd = (view: View, at: number): number => {
  const note = view.chart.notes[at];
  return note === undefined ? Number.POSITIVE_INFINITY : note.t + note.holdSec;
};

/**
 * The records of a hit at song time `t`, which pop the ring and make the pal dance: one in the tapped lane, or one in
 * each lane of a double, whose 2 pals lean toward each other and clap. `count` is the number of hits so far.
 */
const hitRecords = (
  hit: Extract<PlayEvent, { type: 'hit' }>,
  lanes: readonly Lane[],
  { t, count }: { t: number; count: number }
): HitRecord[] => {
  const great = hit.grade === 'great';
  return lanes.length === 1
    ? [makeHit({ lane: hit.lane, at: t, great, side: count % 2 === 0 ? 1 : -1, clap: false })]
    : lanes.map((lane) =>
        makeHit({ lane, at: t, great, side: lanes.some((other) => other > lane) ? 1 : -1, clap: true })
      );
};

/** What the view remembers of the play so far: the hit notes, the soft holds, the hits, and the done holds. */
type Memory = Pick<View, 'hitNotes' | 'holds'> & { readonly hits: HitRecord[]; readonly dones: HoldDone[] };

/** The view object of the frames over the memory, and the update that moves it to a song time. */
const frameView = (
  chart: ChildChart,
  beats: readonly Beat[],
  memory: Memory
): { view: View; update: (t: number) => void } => {
  const first: Mutable<Windows> = { note: 0, beat: 0, hit: 0 };
  const lanes = [idle(), idle(), idle()] as const;
  const view: Mutable<View> = { chart, beats, ...memory, lanes, first, t: 0 };
  /** Moves the windows forward to the frame time. */
  const moveWindows = (): void => {
    while (noteEnd(view, first.note) < view.t - MISS_FADE_SEC) {
      first.note += 1;
    }
    while ((beats[first.beat]?.t ?? Number.POSITIVE_INFINITY) < view.t - MISS_FADE_SEC) {
      first.beat += 1;
    }
    while ((memory.hits[first.hit]?.at ?? Number.POSITIVE_INFINITY) < view.t - EFFECT_SEC) {
      first.hit += 1;
    }
  };
  const updateLane = (lane: Lane): void => {
    const hit = latestHit(view, lane);
    const state = lanes[lane];
    state.near = nearness(view, lane);
    state.held = isHeld(view, lane);
    state.doneAge = doneAge(view, lane);
    state.hitAge = view.t - (hit?.at ?? Number.NEGATIVE_INFINITY);
    state.great = hit?.great ?? false;
    state.side = hit?.side ?? 1;
    state.clap = hit?.clap ?? false;
  };
  return {
    view,
    update: (t) => {
      view.t = t;
      moveWindows();
      updateLane(0);
      updateLane(1);
      updateLane(2);
    },
  };
};

export const makeView = (chart: ChildChart, beats: readonly Beat[]): LiveView => {
  const holds = makeHolds(chart.notes.length);
  const memory: Memory = { hitNotes: new Uint8Array(chart.notes.length), holds: holds.holds, hits: [], dones: [] };
  const { hits, dones } = memory;
  const record = (hit: Extract<PlayEvent, { type: 'hit' }>, t: number, action: Action): void => {
    memory.hitNotes[hit.note] = 1;
    if ((chart.notes[hit.note]?.holdSec ?? 0) > 0 && action.type === 'press') {
      holds.grab(hit.note, action.pointerId);
    }
    hits.push(...hitRecords(hit, chart.notes[hit.note]?.lanes ?? [hit.lane], { t, count: hits.length }));
  };
  const follow = (event: PlayEvent, action: Action, t: number): void => {
    if (event.type === 'hit') {
      record(event, t, action);
    } else if (event.type === 'holdDone') {
      dones.push({ note: event.note, at: t });
    }
  };
  const { view, update } = frameView(chart, beats, memory);
  return {
    view: () => view,
    // An action with no event (most frames) changes nothing here.
    track: (action, events, t) => {
      for (const event of events) {
        follow(event, action, t);
      }
      if (action.type === 'release') {
        holds.letGo(action.pointerId);
      }
    },
    update,
  };
};

/** The latest song time that the highway shows. */
export const lastShown = (t: number): number => t + LOOK_AHEAD + 0.15;
