// The notes of the play screen (prototype play-style A: `drawBubble`, `drawTail`, `drawBead`, `drawDouble`,
// `drawHalfPop`). A plain note is a bubble. A soft hold adds a band up to its end and a star bead at its half; while a
// finger holds it, its head sits still on the ring, the band runs down to the ring, and the bead falls into it. A done
// hold pops its bead. A double is 2 bubbles joined by a jelly band on 2 adjacent lanes.

import { shapeKey } from './atlas';
import { laneX, noteY } from './geometry';
import { HOLD } from './held';
import { BAND_SHARE } from './hold-shapes';
import { BAND_DOT_GAP, BAND_STRIP } from './paint-holds';
import { lastShown, MISS_FADE_SEC, type View } from './view';
import type { Lane } from '../../model';
import type { EffectScene } from './effects';
import type { Pool } from './pool';

/** What the notes of one frame need. `notes` are clipped to the chutes; `links` are not. */
export type NoteFrame = {
  readonly notes: Pool;
  /** The parts that cross between the chutes or sit on the rings: doubles, held heads, and popped beads. */
  readonly links: Pool;
  readonly view: View;
  readonly scene: EffectScene;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** The bead pops for this long when a hold is done (prototype `drawHalfPop`). */
const POP_SEC = 0.6;
/** The light dots of a band sit this share of its half width to the side, in turn left and right. */
const DOT_SIDE = 0.62;

/**
 * The hold band of a lane from `bottom` up to `top`. Its light dots move with `anchor`, the y of its head. One band
 * object serves each frame, so a frame makes no object for its bands (C20).
 */
const band = { lane: 0 as Lane, bottom: 0, top: 0, anchor: 0, held: false, alpha: 0 };

/** Draws `band`. */
const drawBand = ({ notes, scene }: NoteFrame): void => {
  const { lane, bottom, top, anchor, held, alpha } = band;
  if (top >= bottom - 1 || alpha <= 0) {
    return;
  }
  const { geometry, textures } = scene;
  const x = laneX(geometry, lane);
  const half = geometry.noteS * BAND_SHARE;
  const strip = notes.show(textures.shape(shapeKey.bandStrip(lane, held)), alpha);
  strip.position.set(x, (bottom + top) / 2);
  strip.scale.set(1, (bottom - top) / BAND_STRIP);
  notes.show(textures.shape(shapeKey.bandCap(lane, held)), alpha).position.set(x, top);
  const dot = textures.shape(shapeKey.bandDot(lane, held));
  // The dots sit every `BAND_DOT_GAP` above the head, from 6 px above the bottom up to the cap.
  const first = Math.max(1, Math.ceil((anchor - bottom + 6) / BAND_DOT_GAP));
  for (let k = first; anchor - k * BAND_DOT_GAP >= top + half; k += 1) {
    notes.show(dot, alpha).position.set(x + (k % 2 === 1 ? DOT_SIDE : -DOT_SIDE) * half, anchor - k * BAND_DOT_GAP);
  }
};

/** A soft hold that a finger holds: the band runs down to the ring, and the head sits still on the ring. */
const drawHeld = (frame: NoteFrame, at: number): void => {
  const { view, scene, notes, links } = frame;
  const note = view.chart.notes[at];
  if (note === undefined || view.holds[at] !== HOLD.held || view.t >= note.t + note.holdSec) {
    return;
  }
  const [lane] = note.lanes;
  const { geometry, textures } = scene;
  const x = laneX(geometry, lane);
  band.lane = lane;
  band.held = true;
  band.alpha = 1;
  band.bottom = geometry.hitY;
  band.top = noteY(geometry, note.t + note.holdSec - view.t);
  band.anchor = noteY(geometry, note.t - view.t);
  drawBand(frame);
  const half = note.t + note.holdSec / 2;
  if (view.t < half) {
    notes.show(textures.shape(shapeKey.bead(lane)), 1).position.set(x, noteY(geometry, half - view.t));
  }
  links.show(textures.shape(shapeKey.heldBubble(lane)), 1).position.set(x, geometry.hitY);
};

/** A double at the y of `band`: the jelly band between its 2 adjacent lanes, and a bubble on each lane. */
const drawDouble = ({ links, scene }: NoteFrame, lanes: readonly [Lane, Lane]): void => {
  const { geometry, textures } = scene;
  const { anchor: y, alpha } = band;
  const [left, right] = lanes;
  const x = (laneX(geometry, left) + laneX(geometry, right)) / 2;
  links.show(textures.shape(shapeKey.link(left === 0 ? 0 : 1)), alpha).position.set(x, y);
  links.show(textures.shape(shapeKey.bubble(left)), alpha).position.set(laneX(geometry, left), y);
  links.show(textures.shape(shapeKey.bubble(right)), alpha).position.set(laneX(geometry, right), y);
};

/** The band and the bead of a soft hold that falls, with the lane, the head y, and the alpha of `band`. */
const drawFallingHold = (frame: NoteFrame, dt: number, holdSec: number): void => {
  const { geometry, textures } = frame.scene;
  band.bottom = band.anchor;
  band.top = noteY(geometry, dt + holdSec);
  band.held = false;
  drawBand(frame);
  const bead = frame.notes.show(textures.shape(shapeKey.bead(band.lane)), band.alpha);
  bead.position.set(laneX(geometry, band.lane), noteY(geometry, dt + holdSec / 2));
};

const drawNote = (frame: NoteFrame, at: number): void => {
  const { notes, view, scene } = frame;
  const note = view.chart.notes[at];
  const dt = (note?.t ?? 0) - view.t;
  if (note !== undefined && view.hitNotes[at] === 1) {
    drawHeld(frame, at);
    return;
  }
  if (note === undefined || dt < -MISS_FADE_SEC) {
    return;
  }
  const { geometry, textures } = scene;
  const y = noteY(geometry, dt);
  // A note fades in at the top, and a missed note fades out below its ring.
  band.alpha = clamp01(Math.min((y - geometry.topY + 20) / 60, dt < 0 ? 1 + dt / MISS_FADE_SEC : 1));
  band.anchor = y;
  if (note.lanes.length === 2) {
    drawDouble(frame, note.lanes);
    return;
  }
  const [lane] = note.lanes;
  band.lane = lane;
  if (note.holdSec > 0) {
    drawFallingHold(frame, dt, note.holdSec);
  }
  notes.show(textures.shape(shapeKey.bubble(lane)), band.alpha).position.set(laneX(geometry, lane), y);
};

/** The pop of the star bead of a done hold: up from the ring, with a fade (prototype `drawHalfPop`). */
const drawPop = ({ links, view, scene }: NoteFrame, done: View['dones'][number]): void => {
  const lane = view.chart.notes[done.note]?.lanes[0];
  const age = view.t - done.at;
  if (lane === undefined || age < 0) {
    return;
  }
  const { geometry, reduced } = scene;
  const rise = reduced ? 0 : (1 - (1 - age / POP_SEC) ** 3) * geometry.ringD * 0.4;
  const pop = links.show(scene.textures.shape(shapeKey.popStar), 1 - (age / POP_SEC) ** 3);
  pop.position.set(laneX(geometry, lane), geometry.hitY - geometry.ringD / 2 - 12 - rise);
  pop.scale.set(reduced ? 1 : 1 + 0.4 * Math.min(1, age / 0.12));
  pop.rotation = reduced ? 0 : age * 2;
};

/** The star bead of each done hold pops up from its ring and fades: the latest done holds, while they pop. */
const drawPops = (frame: NoteFrame): void => {
  const { view } = frame;
  let at = view.dones.length - 1;
  let done = view.dones[at];
  while (done !== undefined && view.t - done.at < POP_SEC) {
    drawPop(frame, done);
    at -= 1;
    done = view.dones[at];
  }
};

/** Draws the notes of the frame. */
export const drawNotes = (frame: NoteFrame): void => {
  const { notes, links, view } = frame;
  notes.begin();
  links.begin();
  for (let at = view.first.note; (view.chart.notes[at]?.t ?? Number.POSITIVE_INFINITY) < lastShown(view.t); at += 1) {
    drawNote(frame, at);
  }
  drawPops(frame);
  notes.end();
  links.end();
};
