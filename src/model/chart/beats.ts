// The beats of a chart from its time signatures (chart-formats.md, section 2.8).
// A chart with no time signature at tick 0 is in 4/4 up to its first time signature, so it gets a beat on each quarter note.

/** A time signature from `tick` on: `numerator` beats in each bar, and a beat is a 1/`denominator` note. */
export type TimeSignature = { tick: number; numerator: number; denominator: number };

/** A beat at a tick. `downbeat` marks the first beat of a bar. */
export type BeatTick = { tick: number; downbeat: boolean };

const FOUR_FOUR: TimeSignature = { tick: 0, numerator: 4, denominator: 4 };

/** A whole note is 4 quarter notes. */
const QUARTERS_IN_WHOLE = 4;

/**
 * The beats from tick 0 to `endTick`, and then to the end of that bar.
 * Each time signature starts a new bar at its tick.
 */
export const beatTicks = (signatures: readonly TimeSignature[], resolution: number, endTick: number): BeatTick[] => {
  const sorted = signatures.toSorted((a, b) => a.tick - b.tick);
  const all = sorted[0]?.tick === 0 ? sorted : [FOUR_FOUR, ...sorted];
  return all.flatMap((signature, index) => {
    const until = all[index + 1]?.tick ?? Number.POSITIVE_INFINITY;
    const step = (resolution * QUARTERS_IN_WHOLE) / signature.denominator;
    const beats: BeatTick[] = [];
    let count = 0;
    let tick = signature.tick;
    while (tick < until && (tick <= endTick || count % signature.numerator !== 0)) {
      beats.push({ tick, downbeat: count % signature.numerator === 0 });
      count += 1;
      tick = signature.tick + count * step;
    }
    return beats;
  });
};
