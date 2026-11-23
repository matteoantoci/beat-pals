// The play model (spec, "Play rules", "Band energy", and "Play model interface"). It judges the taps of one play
// against the child chart and gives the events that the play screen shows and plays. Each `t` is the song time in
// seconds from the guarded song clock. A note with 2 lanes (a double) counts when either lane is tapped. A soft hold
// counts at its tap, as a plain note. When the finger stays down to its half point, the hold is done. An early
// release is never a miss.

import { energyStep, hitEnergy, passEnergy, START_ENERGY, type Energy, type EnergyStep } from './energy';
import { goodWindows, GREAT_SEC } from './windows';
import type { ChildChart } from '../child/child-chart';

/** A lane: 0 Pip, 1 Dot, 2 Bo. */
export type Lane = ChildChart['band'][number];

/** Each action is one input of the play screen. */
export type Action =
  /** A pointer goes down in a lane. The play screen does not send a pointer that goes down on the pause button. */
  | { readonly type: 'press'; readonly t: number; readonly lane: Lane; readonly pointerId: number }
  /** A pointer goes up, or the browser cancels it. */
  | { readonly type: 'release'; readonly t: number; readonly pointerId: number }
  /** The song time moves on. A time lower than before (the clock after a resume) is no harm. */
  | { readonly type: 'advance'; readonly t: number }
  /** The play ends from the pause screen, with no result. */
  | { readonly type: 'quit' };

/** Each event is one thing that the play screen shows or plays. */
export type PlayEvent =
  /** A tap hit a note. The clap plays at `soundAt`: the note time for an early tap, the tap time for a late tap. */
  | { readonly type: 'hit'; readonly lane: Lane; readonly grade: 'great' | 'good'; readonly soundAt: number }
  /** A tap in the lane of a waiting pal: the pal hops. */
  | { readonly type: 'hop'; readonly lane: Lane }
  /** The good window of the note ended with no hit. `note` is the index in the child chart. */
  | { readonly type: 'faded'; readonly note: number }
  /** The finger stayed down to the half point of the soft hold. `note` is the index in the child chart. */
  | { readonly type: 'holdDone'; readonly note: number }
  /** The band energy changed to this step. */
  | { readonly type: 'energy'; readonly step: EnergyStep };

/** One play. Only the model reads its fields. */
export type PlayState = {
  readonly chart: ChildChart;
  /** The good window of each note, in seconds. */
  readonly good: readonly number[];
  /** True for each note that a tap hit. */
  readonly hit: readonly boolean[];
  readonly hits: number;
  /** The notes before this index passed the end of their good window: a tap can no longer hit them. */
  readonly passed: number;
  /** The lane of each pointer that is down. */
  readonly down: ReadonlyMap<number, Lane>;
  /** The soft hold (its note index) of each pointer that hit a soft hold and is still down before its half point. */
  readonly holding: ReadonlyMap<number, number>;
  readonly energy: Energy;
  readonly quit: boolean;
};

type Outcome = { readonly state: PlayState; readonly events: readonly PlayEvent[] };

/** The play of a child chart, before the song starts. */
export const startPlay = (chart: ChildChart): PlayState => ({
  chart,
  good: goodWindows(chart.notes.map((note) => note.t)),
  hit: chart.notes.map(() => false),
  hits: 0,
  passed: 0,
  down: new Map(),
  holding: new Map(),
  energy: START_ENERGY,
  quit: false,
});

/** The open note in the lane nearest to the tap time and inside its good window. At equal distance, the earlier note. */
const nearestOpen = (play: PlayState, lane: Lane, t: number): number | undefined => {
  // The notes before `passed` are closed.
  const open = play.chart.notes.flatMap((note, at) =>
    at >= play.passed && !play.hit[at] && note.lanes.includes(lane) && Math.abs(t - note.t) <= (play.good[at] ?? 0)
      ? [{ at, gap: Math.abs(t - note.t) }]
      : []
  );
  return open.reduce<(typeof open)[number] | undefined>(
    (best, candidate) => (best === undefined || candidate.gap < best.gap ? candidate : best),
    undefined
  )?.at;
};

/** The energy event when the step changed. */
const energyEvents = (before: Energy, after: Energy): PlayEvent[] =>
  before.step === after.step ? [] : [{ type: 'energy', step: energyStep(after) }];

const press = (play: PlayState, { t, lane, pointerId }: Extract<Action, { type: 'press' }>): Outcome => {
  const secondContact = [...play.down.values()].includes(lane);
  const down = new Map(play.down).set(pointerId, lane);
  if (secondContact) {
    return { state: { ...play, down }, events: [] };
  }
  if (!play.chart.band.includes(lane)) {
    return { state: { ...play, down }, events: [{ type: 'hop', lane }] };
  }
  const at = nearestOpen(play, lane, t);
  const note = at === undefined ? undefined : play.chart.notes[at];
  if (at === undefined || note === undefined) {
    return { state: { ...play, down }, events: [] };
  }
  const energy = hitEnergy(play.energy, t);
  const grade = Math.abs(t - note.t) <= GREAT_SEC ? 'great' : 'good';
  return {
    state: {
      ...play,
      down,
      holding: note.holdSec > 0 ? new Map(play.holding).set(pointerId, at) : play.holding,
      hit: play.hit.with(at, true),
      hits: play.hits + 1,
      energy,
    },
    events: [{ type: 'hit', lane, grade, soundAt: Math.max(t, note.t) }, ...energyEvents(play.energy, energy)],
  };
};

const release = (play: PlayState, pointerId: number): Outcome => {
  if (!play.down.has(pointerId)) {
    return { state: play, events: [] };
  }
  const down = new Map(play.down);
  down.delete(pointerId);
  const holding = new Map(play.holding);
  holding.delete(pointerId);
  return { state: { ...play, down, holding }, events: [] };
};

/** Each soft hold whose finger stayed down to its half point by `t` is done. */
const finishHolds = (play: PlayState, t: number): Outcome => {
  const done = [...play.holding].filter(([, at]) => {
    const note = play.chart.notes[at];
    return note !== undefined && note.t + note.holdSec / 2 <= t;
  });
  if (done.length === 0) {
    return { state: play, events: [] };
  }
  const holding = new Map(play.holding);
  done.forEach(([pointerId]) => holding.delete(pointerId));
  return {
    state: { ...play, holding },
    events: done.map(([, note]) => ({ type: 'holdDone', note })),
  };
};

/** Each note whose good window ended before `t` passes: a note with no hit fades, and the energy can drop. */
const passNotes = (play: PlayState, t: number): Outcome => {
  const { notes } = play.chart;
  const passedAt = (at: number): number => (notes[at]?.t ?? Number.POSITIVE_INFINITY) + (play.good[at] ?? 0);
  let passed = play.passed;
  while (passedAt(passed) < t) {
    passed += 1;
  }
  if (passed === play.passed) {
    return { state: play, events: [] };
  }
  const faded = Array.from({ length: passed - play.passed }, (_, step) => play.passed + step).filter(
    (at) => !play.hit[at]
  );
  const events: PlayEvent[] = [];
  let energy = play.energy;
  for (const at of faded) {
    const before = energy;
    energy = passEnergy(energy, passedAt(at));
    events.push({ type: 'faded', note: at }, ...energyEvents(before, energy));
  }
  return { state: { ...play, passed, energy }, events };
};

/** The soft holds at their half point are done. Then the notes pass: see `passNotes`. */
const advance = (play: PlayState, t: number): Outcome => {
  const held = finishHolds(play, t);
  const passing = passNotes(held.state, t);
  return { state: passing.state, events: [...held.events, ...passing.events] };
};

/** Applies one action. An action that changes nothing returns the same state object. After `quit`, nothing changes. */
export const apply = (play: PlayState, action: Action): Outcome => {
  if (play.quit) {
    return { state: play, events: [] };
  }
  switch (action.type) {
    case 'press':
      return press(play, action);
    case 'release':
      return release(play, action.pointerId);
    case 'advance':
      return advance(play, action.t);
    case 'quit':
      return { state: { ...play, quit: true }, events: [] };
    default: {
      // A new member of the `Action` union must get its case above. This line keeps the switch complete.
      const unhandled: never = action;
      return unhandled;
    }
  }
};

/** The hit ratio of the play: notes hit divided by notes in the child chart. Null after `quit`. */
export const result = (play: PlayState): number | null => {
  if (play.quit) {
    return null;
  }
  return play.chart.notes.length === 0 ? 0 : play.hits / play.chart.notes.length;
};
