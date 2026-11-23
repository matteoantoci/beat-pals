// The band energy as the play screen shows it (spec, "Band energy"). The play model gives each step change; this
// track remembers the changes, so each frame knows how much of each lasting effect shows and whether a level-up
// moment plays. A lasting effect fades in and out over 0.8 s, so it never changes the brightness fast (C11). A
// frame at the same song time always looks the same.

import type { EnergyStep } from '../../model';

/** The number of the gold step: steps 0 to 3 keep their number. */
export const GOLD = 4;
const FADE_SEC = 0.8;
/** The level-up moment lasts this long; the gold moment is longer. */
const LEVEL_UP_SEC = 0.7;
const GOLD_UP_SEC = 1.1;

/** The energy in one frame. */
export type EnergyLook = {
  /** The step from 0 to 4 (gold). */
  readonly step: number;
  /** How much of the lasting effect of step 1, 2, 3, and gold shows, from 0 to 1. */
  readonly fades: readonly [number, number, number, number];
  /** The level-up moment: the step that she reached, the seconds since, and the share of the moment that passed. */
  readonly levelUp: { readonly to: number; readonly age: number; readonly progress: number } | undefined;
};

export type EnergyTrack = {
  /** Remembers a step change at song time `t`. True for a step up. */
  readonly record: (step: EnergyStep, t: number) => boolean;
  /** The look at song time `t`. Each call fills the same look object, so a frame makes no object (C20). */
  readonly at: (t: number) => EnergyLook;
};

/** The fade of one lasting effect: its value at the last change, and its direction since then. */
type Fade = { readonly from: number; readonly since: number; readonly on: boolean };

const OFF: Fade = { from: 0, since: 0, on: false };

/** One value for each lasting effect: steps 1, 2, 3, and gold. */
type Four<T> = readonly [T, T, T, T];

const mapFour = <T, U>(four: Four<T>, map: (value: T, at: number) => U): Four<U> => [
  map(four[0], 0),
  map(four[1], 1),
  map(four[2], 2),
  map(four[3], 3),
];

const fadeAt = (fade: Fade, t: number): number => {
  const moved = Math.max(0, t - fade.since) / FADE_SEC;
  return fade.on ? Math.min(1, fade.from + moved) : Math.max(0, fade.from - moved);
};

export const makeEnergyTrack = (): EnergyTrack => {
  let current = 0;
  let fades: Four<Fade> = [OFF, OFF, OFF, OFF];
  /** The last step up: the step that she reached and the song time. */
  const lastUp = { to: 0, at: Number.NEGATIVE_INFINITY };
  const lookFades: [number, number, number, number] = [0, 0, 0, 0];
  const levelUp = { to: 0, age: 0, progress: 0 };
  const look: { step: number; fades: Four<number>; levelUp: typeof levelUp | undefined } = {
    step: 0,
    fades: lookFades,
    levelUp: undefined,
  };
  return {
    record: (step, t) => {
      const next = step === 'gold' ? GOLD : step;
      const up = next > current;
      fades = mapFour(fades, (fade, at) => ({ from: fadeAt(fade, t), since: t, on: at < next }));
      current = next;
      if (up) {
        lastUp.to = next;
        lastUp.at = t;
      }
      return up;
    },
    at: (t) => {
      const age = t - lastUp.at;
      const life = lastUp.to === GOLD ? GOLD_UP_SEC : LEVEL_UP_SEC;
      look.step = current;
      for (let at = 0; at < 4; at += 1) {
        lookFades[at] = fadeAt(fades[at] ?? OFF, t);
      }
      levelUp.to = lastUp.to;
      levelUp.age = age;
      levelUp.progress = age / life;
      look.levelUp = age >= 0 && age < life ? levelUp : undefined;
      return look;
    },
  };
};
