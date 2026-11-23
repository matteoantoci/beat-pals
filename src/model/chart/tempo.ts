// The tick clock: chart ticks to seconds over the tempo map (chart-formats.md, section 2.7).
// The .chart reader and the .mid reader both use it, so both formats get the same times.

/** A tempo change: `bpm` quarter notes per minute from `tick` on. */
export type Tempo = { tick: number; bpm: number };

type Segment = Tempo & { sec: number };

/** The tempo before the first tempo change of a chart. */
const START: Segment = { tick: 0, bpm: 120, sec: 0 };

const SECONDS_PER_MINUTE = 60;

/**
 * A function from a tick to its time in seconds. `resolution` is the number of ticks in a quarter note.
 * A chart with no tempo at tick 0 plays at 120 BPM up to its first tempo change.
 */
export const tickClock = (tempos: readonly Tempo[], resolution: number): ((tick: number) => number) => {
  const secondsIn = (tempo: Tempo, ticks: number): number => (ticks / resolution) * (SECONDS_PER_MINUTE / tempo.bpm);
  const sorted = tempos.toSorted((a, b) => a.tick - b.tick);
  const first = sorted[0]?.tick === 0 ? [] : [START];
  const segments: Segment[] = [];
  for (const tempo of [...first, ...sorted]) {
    const before = segments.at(-1);
    const sec = before === undefined ? 0 : before.sec + secondsIn(before, tempo.tick - before.tick);
    segments.push({ ...tempo, sec });
  }
  return (tick) => {
    const segment = segments.findLast((each) => each.tick <= tick) ?? START;
    return segment.sec + secondsIn(segment, tick - segment.tick);
  };
};
