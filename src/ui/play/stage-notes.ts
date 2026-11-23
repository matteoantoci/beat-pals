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
type NoteFrame = {
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

/** A hold band of a lane from `bottom` up to `top`. Its light dots move with `anchor`, the y of its head. */
type Band = { readonly lane: Lane; readonly bottom: number; readonly top: number; readonly anchor: number };

const drawBand = ({ notes, scene }: NoteFrame, band: Band, look: { held: boolean; alpha: number }): void => {
  const { lane, bottom, top, anchor } = band;
  if (top >= bottom - 1 || look.alpha <= 0) {
    return;
  }
  const { geometry, textures } = scene;
  const x = laneX(geometry, lane);
  const half = geometry.noteS * BAND_SHARE;
  const { alpha, held } = look;
  const scaleY = (bottom - top) / BAND_STRIP;
  notes.show(textures.shape(shapeKey.bandStrip(lane, held)), { x, y: (bottom + top) / 2, alpha, scaleY });
  notes.show(textures.shape(shapeKey.bandCap(lane, held)), { x, y: top, alpha });
  const dot = textures.shape(shapeKey.bandDot(lane, held));
  // The dots sit every `BAND_DOT_GAP` above the head, from 6 px above the bottom up to the cap.
  const first = Math.max(1, Math.ceil((anchor - bottom + 6) / BAND_DOT_GAP));
  for (let k = first; anchor - k * BAND_DOT_GAP >= top + half; k += 1) {
    notes.show(dot, { x: x + (k % 2 === 1 ? DOT_SIDE : -DOT_SIDE) * half, y: anchor - k * BAND_DOT_GAP, alpha });
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
  const band = { lane, bottom: geometry.hitY, top: noteY(geometry, note.t + note.holdSec - view.t) };
  drawBand(frame, { ...band, anchor: noteY(geometry, note.t - view.t) }, { held: true, alpha: 1 });
  const half = note.t + note.holdSec / 2;
  if (view.t < half) {
    notes.show(textures.shape(shapeKey.bead(lane)), {
      x: laneX(geometry, lane),
      y: noteY(geometry, half - view.t),
      alpha: 1,
    });
  }
  links.show(textures.shape(shapeKey.heldBubble(lane)), { x: laneX(geometry, lane), y: geometry.hitY, alpha: 1 });
};

/** A double: the jelly band between its 2 adjacent lanes, and a bubble on each lane. */
const drawDouble = (
  { links, scene }: NoteFrame,
  lanes: readonly [Lane, Lane],
  look: { y: number; alpha: number }
): void => {
  const { geometry, textures } = scene;
  const [left, right] = lanes;
  const x = (laneX(geometry, left) + laneX(geometry, right)) / 2;
  links.show(textures.shape(shapeKey.link(left === 0 ? 0 : 1)), { x, ...look });
  for (const lane of lanes) {
    links.show(textures.shape(shapeKey.bubble(lane)), { x: laneX(geometry, lane), ...look });
  }
};

/** The band and the bead of a soft hold that falls: its head is `dt` seconds above the ring. */
const drawFallingHold = (
  frame: NoteFrame,
  hold: { readonly lane: Lane; readonly dt: number; readonly holdSec: number },
  alpha: number
): void => {
  const { geometry, textures } = frame.scene;
  const { lane, dt, holdSec } = hold;
  const y = noteY(geometry, dt);
  drawBand(frame, { lane, bottom: y, top: noteY(geometry, dt + holdSec), anchor: y }, { held: false, alpha });
  frame.notes.show(textures.shape(shapeKey.bead(lane)), {
    x: laneX(geometry, lane),
    y: noteY(geometry, dt + holdSec / 2),
    alpha,
  });
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
  const alpha = clamp01(Math.min((y - geometry.topY + 20) / 60, dt < 0 ? 1 + dt / MISS_FADE_SEC : 1));
  if (note.lanes.length === 2) {
    drawDouble(frame, note.lanes, { y, alpha });
    return;
  }
  const [lane] = note.lanes;
  if (note.holdSec > 0) {
    drawFallingHold(frame, { lane, dt, holdSec: note.holdSec }, alpha);
  }
  notes.show(textures.shape(shapeKey.bubble(lane)), { x: laneX(geometry, lane), y, alpha });
};

/** The pop of the star bead `age` seconds after its hold was done: up from the ring, with a fade. */
const popLook = (scene: EffectScene, lane: Lane, age: number): Parameters<Pool['show']>[1] => {
  const { geometry, reduced } = scene;
  const rise = reduced ? 0 : (1 - (1 - age / POP_SEC) ** 3) * geometry.ringD * 0.4;
  return {
    x: laneX(geometry, lane),
    y: geometry.hitY - geometry.ringD / 2 - 12 - rise,
    alpha: age < 0 ? 0 : 1 - (age / POP_SEC) ** 3,
    scale: reduced ? 1 : 1 + 0.4 * Math.min(1, age / 0.12),
    rotation: reduced ? 0 : age * 2,
  };
};

/** The star bead of each done hold pops up from its ring and fades (prototype `drawHalfPop`). */
const drawPops = ({ links, view, scene }: NoteFrame): void => {
  const texture = scene.textures.shape(shapeKey.popStar);
  for (let at = view.dones.length - 1; at >= 0 && view.t - (view.dones[at]?.at ?? 0) < POP_SEC; at -= 1) {
    const done = view.dones[at];
    const lane = done === undefined ? undefined : view.chart.notes[done.note]?.lanes[0];
    links.show(texture, lane === undefined ? { x: 0, y: 0, alpha: 0 } : popLook(scene, lane, view.t - (done?.at ?? 0)));
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
