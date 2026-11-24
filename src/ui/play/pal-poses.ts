// The poses of the pals of the play screen (see ./pals). A hit makes the pal dance: a squash, a jump, and a lean that
// changes side from hit to hit (P11). After a double hit, the 2 pals lean toward each other and press in, as a clap.
// The ready state with the open mouth starts 0.55 s before the next note of the pal. An idle pal bobs 2 px on the
// strong beats only (C15); the band energy makes the idle dance bigger and, from step 1, gives the pals the "joy"
// face (spec, "Band energy"). With reduced motion, a pal changes its picture and does not move (C16).
// Each function fills in the one `pose` object, so a frame makes no object (C20).

import type { Lane } from '../../model';
import type { PalState } from '../pals/pal-svg';
import type { EnergyLook } from './energy';
import type { LaneState } from './view';

const HAPPY_SEC = 0.5;
/** A waiting pal smiles this long after a hit of the band, and this long after a tap in its column. */
const WAIT_SMILE_SEC = 0.3;
const HOP_SMILE_SEC = 0.4;
/** The hop of a waiting pal, and of a holding pal when its star bead pops. */
const HOP_SEC = 0.3;
const HOP_PX = 8;
const SQUASH_SEC = 0.06;

/** One pal picture in one frame: its state and its transform. `dx` moves it to the side, for the clap. */
export const pose = { state: 'idle' as PalState, ty: 0, rot: 0, sx: 1, sy: 1, dx: 0 };

/** Where the frame is in its beat: the share of the beat that passed (0 before the first beat), and whether the
 * beat is strong. Each frame fills it in. */
export const beat = { phase: 0, strong: false };

/** Sets the pose to its state, standing still. */
const still = (state: PalState): void => {
  pose.state = state;
  pose.ty = 0;
  pose.rot = 0;
  pose.sx = 1;
  pose.sy = 1;
  pose.dx = 0;
};

/**
 * The idle dance of a band pal. Step 0: a 2 px bob in the first half of each strong beat. Steps 1 and 2: a 10 px
 * bounce on each beat, Dot on the off-beat. Step 3 and gold: the band jumps 18 px together on the beat and squashes
 * a little when it lands. Each dance fades into the next one with the step (prototype play-style A, energy). With
 * reduced motion, the pal stands still.
 */
export const idlePose = (lane: Lane, energy: EnergyLook, reduced: boolean): void => {
  still(energy.step >= 1 ? 'joy' : 'idle');
  if (reduced) {
    return;
  }
  const { phase } = beat;
  const bounceShare = energy.fades[0];
  const jumpShare = energy.fades[2];
  const bob = beat.strong && phase < 0.5 ? -2 * Math.sin(2 * Math.PI * phase) : 0;
  const bounce = -10 * Math.sin(Math.PI * ((phase + (lane === 1 ? 0.5 : 0)) % 1));
  const jump = -18 * Math.max(0, Math.sin((Math.PI * phase) / 0.7));
  const land = phase > 0.7 ? jumpShare * Math.sin((Math.PI * (phase - 0.7)) / 0.3) : 0;
  pose.ty = bob * (1 - bounceShare) + bounce * bounceShare * (1 - jumpShare) + jump * jumpShare;
  pose.sx = 1 + 0.05 * land;
  pose.sy = 1 - 0.08 * land;
};

/** The dance after a hit: a squash, then a jump with a lean. A clap leans more and presses in toward the partner. */
const happyPose = (lane: LaneState, reduced: boolean): void => {
  still('happy');
  if (reduced) {
    return;
  }
  const h = lane.hitAge;
  const after = h - SQUASH_SEC;
  const squash = h < SQUASH_SEC ? -0.16 * (h / SQUASH_SEC) : -0.16 * Math.exp(-after * 9) * Math.cos(after * 22);
  const press = lane.clap ? Math.min(1, h / 0.06) * Math.exp(-h * 5) : 0;
  pose.ty = h < SQUASH_SEC ? 0 : -Math.max(0, Math.sin(after * 8)) * 16 * Math.exp(-after * 4);
  pose.rot = lane.side * (lane.clap ? 12 : 8) * Math.min(1, h / 0.08) * Math.exp(-h * 3);
  pose.sx = 1 - squash * 0.6 - 0.06 * press;
  pose.sy = 1 + squash;
  pose.dx = lane.side * 10 * press;
};

/** The hop of `HOP_PX`, `age` seconds after its start, or 0 after it (or with reduced motion). */
const hop = (age: number, reduced: boolean): number =>
  !reduced && age >= 0 && age < HOP_SEC ? -Math.sin((age / HOP_SEC) * Math.PI) * HOP_PX : 0;

/**
 * The pose of a band pal: happy after a hit, held while a finger holds a soft hold (with a small hop when the star
 * bead pops), ready before its note, else its idle dance (already in `pose`).
 */
export const bandPose = (lane: LaneState, reduced: boolean): void => {
  if (lane.hitAge < HAPPY_SEC) {
    happyPose(lane, reduced);
  } else if (lane.held) {
    still('held');
    pose.ty = hop(lane.doneAge, reduced);
  } else if (lane.near > 0) {
    const stretch = reduced ? 0 : lane.near;
    still('ready');
    pose.sx = 1 - 0.03 * stretch;
    pose.sy = 1 + 0.06 * stretch;
  }
};

/** A waiting pal: a smile while the band hits, and a hop with a smile after a tap in its column. */
export const waitingPose = (hopAge: number, bandHitAge: number, reduced: boolean): void => {
  still(hopAge < HOP_SMILE_SEC || bandHitAge < WAIT_SMILE_SEC ? 'happy' : 'idle');
  pose.ty = hop(hopAge, reduced);
};

/** The cheer of a star moment lasts this long. */
const CHEER_SEC = 1.1;

/** A squash of the pose: `amount` from 0 to 1 makes it this much lower and this much wider. */
const squash = (amount: number, lower: number, wider: number): void => {
  pose.sy = 1 - lower * amount;
  pose.sx = 1 + wider * amount;
};

/** The big jump of the cheer at its share `p`: 40 px up, Pip and Bo leaning outward (`side`), Dot wiggling. */
const cheerJump = (p: number, side: number): void => {
  const up = Math.sin(Math.PI * p);
  pose.ty = -40 * up;
  squash((1 - p) * up, -0.1, -0.05);
  pose.rot = side === 0 ? 8 * Math.sin(2 * Math.PI * p) : side * 12 * up;
};

/**
 * The cheer of a star moment (prototype star-moments `cheer`), for all 3 pals together, `age` seconds after its start:
 * a crouch, a jump of 40 px with Pip and Bo leaning outward and Dot wiggling, a squash on landing, one more hop of
 * 14 px, and a last small squash. In normal play a hit jump is 16 px or less, so the cheer is clearly bigger. Reduced
 * motion: only the happy face. Outside the cheer, the pose stays as it is.
 */
export const cheerPose = (lane: Lane, age: number, reduced: boolean): void => {
  if (age < 0 || age >= CHEER_SEC) {
    return;
  }
  still('happy');
  if (reduced) {
    return;
  }
  const side = lane - 1;
  if (age < 0.08) {
    squash(age / 0.08, 0.14, 0.08);
  } else if (age < 0.56) {
    cheerJump((age - 0.08) / 0.48, side);
  } else if (age < 0.66) {
    squash(Math.sin((Math.PI * (age - 0.56)) / 0.1), 0.12, 0.07);
  } else if (age < 0.96) {
    const up = Math.sin((Math.PI * (age - 0.66)) / 0.3);
    pose.ty = -14 * up;
    pose.rot = -side * 6 * up;
  } else {
    squash(Math.sin((Math.PI * (age - 0.96)) / 0.14), 0.05, 0.03);
  }
};
