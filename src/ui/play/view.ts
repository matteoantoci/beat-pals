// What the play screen shows at a song time, from the child chart, the beats of the facts, and the hits so far.
// The play model judges the taps; the view only remembers the hits that it reported, so the screen can remove the
// hit notes and show the effects. Each frame moves the windows forward: no frame looks at the whole song.

import { LOOK_AHEAD, type Action, type ChildChart, type Lane, type PlayEvent, type SongFacts } from '../../model';
import { EFFECT_SEC, makeHit, type HitRecord } from './effects';
import { HOLD, makeHolds } from './held';

/** The ring and the pal of a lane get ready this long before a note. */
const READY_SEC = 0.55;
/** A missed note fades for this long after its time. */
export const MISS_FADE_SEC = 0.3;
/** A held note is one of this many notes from the first note that still shows. */
const HELD_REACH = 4;

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
  readonly view: () => View;
  /**
   * Follows an action and its events at song time `t`: it remembers each hit (and the soft hold that the pointer of
   * the press holds), lets go of the soft hold of a released pointer, and remembers each done hold.
   */
  readonly track: (action: Action, events: readonly PlayEvent[], t: number) => void;
  /** Moves the view to song time `t`. */
  readonly update: (t: number) => void;
};

const IDLE: LaneState = {
  near: 0,
  hitAge: Number.POSITIVE_INFINITY,
  great: false,
  side: 1,
  clap: false,
  held: false,
  doneAge: Number.POSITIVE_INFINITY,
};

/** The first index from `start` whose time is not before `from`. */
const firstFrom = (times: (at: number) => number | undefined, start: number, from: number): number => {
  let at = start;
  while ((times(at) ?? Number.POSITIVE_INFINITY) < from) {
    at += 1;
  }
  return at;
};

const windowsAt = (view: View, t: number): Windows => ({
  // A soft hold shows to its end. Holds end before the next note, so the end times stay in order.
  note: firstFrom(
    (at) => {
      const note = view.chart.notes[at];
      return note === undefined ? undefined : note.t + note.holdSec;
    },
    view.first.note,
    t - MISS_FADE_SEC
  ),
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

/** True while a finger holds a soft hold of the lane before its end. */
const isHeld = (view: View, lane: Lane): boolean =>
  // A held note still shows, and at most 2 notes that still show come before it: notes are 0.2 s apart or more.
  view.chart.notes
    .slice(view.first.note, view.first.note + HELD_REACH)
    .some(
      (note, at) =>
        view.holds[view.first.note + at] === HOLD.held &&
        note.lanes[0] === lane &&
        note.t <= view.t &&
        view.t < note.t + note.holdSec
    );

/** The seconds since the last soft hold of the lane was done, or Infinity. */
const doneAge = (view: View, lane: Lane): number => {
  const last = view.dones.findLast((done) => view.chart.notes[done.note]?.lanes[0] === lane && done.at <= view.t);
  return last === undefined ? Number.POSITIVE_INFINITY : view.t - last.at;
};

const laneState = (view: View, lane: Lane): LaneState => {
  const hit = latestHit(view, lane);
  const held = { near: nearness(view, lane), held: isHeld(view, lane), doneAge: doneAge(view, lane) };
  return hit === undefined
    ? { ...IDLE, ...held }
    : { ...held, hitAge: view.t - hit.at, great: hit.great, side: hit.side, clap: hit.clap };
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

export const makeView = (chart: ChildChart, beats: readonly Beat[]): LiveView => {
  const hitNotes = new Uint8Array(chart.notes.length);
  const holds = makeHolds(chart.notes.length);
  const hits: HitRecord[] = [];
  const dones: HoldDone[] = [];
  const record = (hit: Extract<PlayEvent, { type: 'hit' }>, t: number, action: Action): void => {
    hitNotes[hit.note] = 1;
    if ((chart.notes[hit.note]?.holdSec ?? 0) > 0 && action.type === 'press') {
      holds.grab(hit.note, action.pointerId);
    }
    hits.push(...hitRecords(hit, chart.notes[hit.note]?.lanes ?? [hit.lane], { t, count: hits.length }));
  };
  let view: View = {
    chart,
    beats,
    hitNotes,
    holds: holds.holds,
    dones,
    hits,
    lanes: [IDLE, IDLE, IDLE],
    first: { note: 0, beat: 0, hit: 0 },
    t: 0,
  };
  return {
    view: () => view,
    track: (action, events, t) => {
      for (const event of events.filter((each) => each.type === 'hit')) {
        record(event, t, action);
      }
      dones.push(...events.flatMap((event) => (event.type === 'holdDone' ? [{ note: event.note, at: t }] : [])));
      if (action.type === 'release') {
        holds.letGo(action.pointerId);
      }
    },
    update: (t) => {
      const moved: View = { ...view, t, first: windowsAt(view, t) };
      view = { ...moved, lanes: [laneState(moved, 0), laneState(moved, 1), laneState(moved, 2)] };
    },
  };
};

/** The latest song time that the highway shows. */
export const lastShown = (t: number): number => t + LOOK_AHEAD + 0.15;
