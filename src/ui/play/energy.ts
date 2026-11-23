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
  let lastUp: { readonly to: number; readonly at: number } | undefined;
  return {
    record: (step, t) => {
      const next = step === 'gold' ? GOLD : step;
      const up = next > current;
      fades = mapFour(fades, (fade, at) => ({ from: fadeAt(fade, t), since: t, on: at < next }));
      current = next;
      lastUp = up ? { to: next, at: t } : lastUp;
      return up;
    },
    at: (t) => {
      const up = lastUp;
      const age = t - (up?.at ?? Number.NEGATIVE_INFINITY);
      const life = up?.to === GOLD ? GOLD_UP_SEC : LEVEL_UP_SEC;
      return {
        step: current,
        fades: mapFour(fades, (fade) => fadeAt(fade, t)),
        levelUp: up !== undefined && age >= 0 && age < life ? { to: up.to, age, progress: age / life } : undefined,
      };
    },
  };
};
