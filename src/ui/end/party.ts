// The joy of the end scene: the pals pop in and dance on a beat of 0.55 s, and at 70% or more confetti falls
// (prototype play-style A, `dance` and `confetti`). Both stop before the scene ends, so the final state is still.

import { css, LANE_COLORS, TOKENS } from '../pals/color';
import { animate } from './animate';
import type { Lane } from '../../model';

/** Who dances: their pictures, and the time in seconds when each dancer starts. */
export type Dancers = {
  readonly pals: readonly HTMLElement[];
  readonly starts: ReadonlyMap<Lane, number>;
  /** The length of the scene in seconds. */
  readonly length: number;
};

const POP_IN_SEC = 0.4;
/** One round is 2 beats: a lean to the left and a lean to the right. */
const DANCE_SEC = 1.1;
const CONFETTI = 56;
const FADE_SEC = 0.6;

const DANCE: Keyframe[] = [
  { transform: 'none' },
  { transform: 'translateY(-12px) rotate(-6deg)' },
  { transform: 'none' },
  { transform: 'translateY(-12px) rotate(6deg)' },
  { transform: 'none' },
];

/** The time when the pals finish their pop-in and can dance. */
export const DANCE_FROM = POP_IN_SEC;

/** The pals pop in, then each dancer dances in whole rounds until the scene ends. */
export const dance = ({ pals, starts, length }: Dancers): void => {
  for (const pal of pals) {
    animate(pal, [{ scale: '0' }, { scale: '1' }], { at: 0, sec: POP_IN_SEC, fill: 'backwards' });
  }
  const rounds = [...starts].flatMap(([lane, at]) => {
    const pal = pals[lane];
    const iterations = Math.floor((length - at) / DANCE_SEC);
    return pal === undefined || iterations < 1 ? [] : [{ pal, at, iterations }];
  });
  for (const { pal, at, iterations } of rounds) {
    animate(pal, DANCE, { at, sec: DANCE_SEC, fill: 'none', easing: 'ease-in-out', iterations });
  }
};

/** A small seeded random source, so the confetti falls the same way each time. */
const seeded = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
};

/** One piece of confetti that falls with a sway and a spin. */
const piece = (box: HTMLElement, color: string, random: () => number): void => {
  const el = document.createElement('i');
  el.className = 'end-confetto';
  el.style.left = `${String(random() * 100)}%`;
  el.style.background = color;
  box.append(el);
  const height = box.clientHeight;
  const at = 0.2 + random() * 2.6;
  const sec = (height + 32) / (140 + random() * 120);
  const sway = 8 + random() * 16;
  const spin = random() * 360;
  const keyframes = [
    { transform: `translate(0px, -16px) rotate(${String(spin)}deg)` },
    { transform: `translate(${String(sway)}px, ${String(height / 2)}px) rotate(${String(spin + 360)}deg)` },
    { transform: `translate(${String(-sway)}px, ${String(height + 16)}px) rotate(${String(spin + 720)}deg)` },
  ];
  animate(el, keyframes, { at, sec, easing: 'linear' });
};

/** 56 pieces in the lane colors and white fall from the top, and all fade out before the scene ends. */
export const confetti = (box: HTMLElement, length: number): void => {
  const random = seeded(42);
  const colors = [...LANE_COLORS.map((lane) => css(lane.base)), css(TOKENS.white)];
  for (let at = 0; at < CONFETTI; at += 1) {
    piece(box, colors[at % colors.length] ?? '', random);
  }
  animate(box, [{ opacity: 1 }, { opacity: 0 }], { at: length - FADE_SEC, sec: FADE_SEC, easing: 'linear' });
};
