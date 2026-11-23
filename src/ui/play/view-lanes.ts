// What the view reads for each lane in a frame: the nearness of the next note, the latest hit, the soft hold that a
// finger holds, and the last done hold. Each one looks only at the windows of the view, and makes no object (C20).

import { HOLD } from './held';
import type { Lane } from '../../model';
import type { HitRecord } from './effects';
import type { View } from './view';

/** The ring and the pal of a lane get ready this long before a note. */
const READY_SEC = 0.55;
/** A held note is one of this many notes from the first note that still shows. */
const HELD_REACH = 4;

/** True when the note at `at` is a note of the lane that is still to come and not hit. */
const isComing = (view: View, at: number, lane: Lane): boolean => {
  const note = view.chart.notes[at];
  return note !== undefined && note.t > view.t && view.hitNotes[at] === 0 && note.lanes.includes(lane);
};

/** The nearness of the next note of the lane, from 0 to 1. */
export const nearness = (view: View, lane: Lane): number => {
  const { notes } = view.chart;
  let at = view.first.note;
  while (at < notes.length && (notes[at]?.t ?? 0) < view.t + READY_SEC && !isComing(view, at, lane)) {
    at += 1;
  }
  const dt = (notes[at]?.t ?? Number.POSITIVE_INFINITY) - view.t;
  return isComing(view, at, lane) && dt < READY_SEC ? 1 - dt / READY_SEC : 0;
};

/** True when the hit at `at` is a hit of the lane at or before the frame time. */
const isLaneHit = (view: View, at: number, lane: Lane): boolean => {
  const hit = view.hits[at];
  return hit?.lane === lane && hit.at <= view.t;
};

/** The latest hit of the lane whose effects can still show. A hit after the frame time (the clock after a resume
 * can be a little lower) does not count yet. */
export const latestHit = (view: View, lane: Lane): HitRecord | undefined => {
  let at = view.hits.length - 1;
  while (at >= view.first.hit && !isLaneHit(view, at, lane)) {
    at -= 1;
  }
  return at >= view.first.hit ? view.hits[at] : undefined;
};

/** True when a finger holds the soft hold at `at` of the lane, and the frame time is inside the hold. */
const isHeldAt = (view: View, at: number, lane: Lane): boolean => {
  const note = view.chart.notes[at];
  return (
    note !== undefined &&
    view.holds[at] === HOLD.held &&
    note.lanes[0] === lane &&
    note.t <= view.t &&
    view.t < note.t + note.holdSec
  );
};

/** True while a finger holds a soft hold of the lane before its end. */
export const isHeld = (view: View, lane: Lane): boolean => {
  // A held note still shows, and at most 2 notes that still show come before it: notes are 0.2 s apart or more.
  const end = Math.min(view.first.note + HELD_REACH, view.chart.notes.length);
  let at = view.first.note;
  while (at < end && !isHeldAt(view, at, lane)) {
    at += 1;
  }
  return at < end;
};

/** True when the done hold at `at` is of the lane and at or before the frame time. */
const isLaneDone = (view: View, at: number, lane: Lane): boolean => {
  const done = view.dones[at];
  return done !== undefined && view.chart.notes[done.note]?.lanes[0] === lane && done.at <= view.t;
};

/** The seconds since the last soft hold of the lane was done, or Infinity. */
export const doneAge = (view: View, lane: Lane): number => {
  let at = view.dones.length - 1;
  while (at >= 0 && !isLaneDone(view, at, lane)) {
    at -= 1;
  }
  return view.t - (view.dones[at]?.at ?? Number.NEGATIVE_INFINITY);
};
