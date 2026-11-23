// Band energy (spec, "Band energy"). Each hit adds one point, and the points give the step. A run of passed notes
// that lasts 1.8 s takes one step away.

/** The step of the band energy, as the play screen draws it. */
export type EnergyStep = 0 | 1 | 2 | 3 | 'gold';

/** The points at which each step starts: steps 0, 1, 2, 3, and gold. */
const STEP_POINTS = [0, 4, 8, 16, 30] as const;
/** A run of passed notes drops one step at a passed note this long after the start of the run. */
const RUN_SEC = 1.8;

export type Energy = {
  readonly points: number;
  /** The index in `STEP_POINTS`. */
  readonly step: number;
  /** The pass time of the first passed note of the current run, or null with no run. */
  readonly runStart: number | null;
  /** The time of the last hit or drop. A note that passed before it is in no run, because that hit or drop came after the note and cleared the run. */
  readonly clearedAt: number;
};

/** The energy at the start of a play. */
export const START_ENERGY: Energy = {
  points: 0,
  step: 0,
  runStart: null,
  clearedAt: Number.NEGATIVE_INFINITY,
};

/** The step value of the `energy` event. */
export const energyStep = (energy: Energy): EnergyStep => {
  const step = energy.step;
  return step === 0 || step === 1 || step === 2 || step === 3 ? step : 'gold';
};

/** The energy after a hit at song time `t`. The hit clears the run. */
export const hitEnergy = (energy: Energy, t: number): Energy => {
  const points = energy.points + 1;
  const next = STEP_POINTS[energy.step + 1];
  const step = next !== undefined && points >= next ? energy.step + 1 : energy.step;
  return { points, step, runStart: null, clearedAt: Math.max(energy.clearedAt, t) };
};

/** The energy after a note passes with no hit at `passedAt`, its time plus the end of its good window. */
export const passEnergy = (energy: Energy, passedAt: number): Energy => {
  if (passedAt <= energy.clearedAt) {
    return energy;
  }
  if (energy.runStart === null) {
    return { ...energy, runStart: passedAt };
  }
  if (passedAt - energy.runStart < RUN_SEC || energy.step === 0) {
    return energy;
  }
  const step = energy.step - 1;
  return { points: STEP_POINTS[step] ?? 0, step, runStart: null, clearedAt: passedAt };
};
