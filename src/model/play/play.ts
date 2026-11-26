// The play model (spec, "Play rules", "Band energy", and "Play model interface"). It judges the taps of one play against
// the child chart and gives the events that the play screen shows and plays. Each `t` is the song time in seconds from
// the guarded song clock. A double counts when either of its 2 lanes is tapped. A soft hold counts at its tap, as a
// plain note; when the finger stays down to its half point, the hold is done. An early release is never a miss. The
// last note of a phrase can give a star moment (./star-moments). No rule waits for a release: iOS can drop both the
// `pointerup` and the `pointercancel` of a touch (WebKit 322561), so a hold that misses its release still ends at its
// half point. An empty tap (./empty-taps) gives no event and changes nothing in the play, but it lowers the score.

import { isEmptyTap, type EmptyTaps, type HitTap } from './empty-taps';
import { energyStep, hitEnergy, passEnergy, START_ENERGY, type Energy } from './energy';
import { phraseEnds, starEvents } from './star-moments';
import { goodWindows, GREAT_SEC } from './windows';
import type { ChildChart } from '../child/child-chart';
import type { Action, Lane, PlayEvent } from './play-events';

/** A contact that starts this close to a tap in its lane is part of that tap: a hand with more than one contact point,
 * or a bounce of the finger. A child taps again in the same lane after 0.26 s at the earliest. */
const SAME_TAP_SEC = 0.15;

/** One play. Only the model reads its fields. */
export type PlayState = {
  readonly chart: ChildChart;
  /** The good window of each note, in seconds. */
  readonly good: readonly number[];
  /** The tap that hit each note, or undefined for a note with no hit. */
  readonly hit: readonly (HitTap | undefined)[];
  readonly hits: number;
  readonly emptyTaps: EmptyTaps;
  /** The number of taps that hit no note and count against the score. */
  readonly emptyCount: number;
  /** The notes before this index passed the end of their good window: a tap can no longer hit them. */
  readonly passed: number;
  /** The song time of the last tap in each lane, or -Infinity before the first tap. */
  readonly tapAt: readonly number[];
  /** The soft hold (its note index) of each pointer that hit a soft hold and is still down before its half point. */
  readonly holding: ReadonlyMap<number, number>;
  readonly energy: Energy;
  /** For each note, the index of the phrase that ends with it, or -1. */
  readonly phraseEnds: readonly number[];
  readonly quit: boolean;
};

type Outcome = { readonly state: PlayState; readonly events: readonly PlayEvent[] };

/** The play of a child chart, before the song starts. */
export const startPlay = (chart: ChildChart, emptyTaps: EmptyTaps): PlayState => ({
  chart,
  good: goodWindows(chart.notes.map((note) => note.t)),
  hit: chart.notes.map(() => undefined),
  hits: 0,
  emptyTaps,
  emptyCount: 0,
  passed: 0,
  tapAt: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  holding: new Map(),
  energy: START_ENERGY,
  phraseEnds: phraseEnds(chart),
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
  // The clock can step back after a resume, so the gap counts in both directions.
  if (Math.abs(t - (play.tapAt[lane] ?? Number.NEGATIVE_INFINITY)) < SAME_TAP_SEC) {
    return { state: play, events: [] };
  }
  const tapAt = play.tapAt.with(lane, t);
  if (!play.chart.band.includes(lane)) {
    return { state: { ...play, tapAt }, events: [{ type: 'hop', lane }] };
  }
  const at = nearestOpen(play, lane, t);
  const note = at === undefined ? undefined : play.chart.notes[at];
  if (at === undefined || note === undefined) {
    const emptyCount = isEmptyTap(play, lane, t) ? play.emptyCount + 1 : play.emptyCount;
    return { state: { ...play, tapAt, emptyCount }, events: [] };
  }
  const energy = hitEnergy(play.energy, t);
  const grade = Math.abs(t - note.t) <= GREAT_SEC ? 'great' : 'good';
  const state = {
    ...play,
    tapAt,
    holding: note.holdSec > 0 ? new Map(play.holding).set(pointerId, at) : play.holding,
    hit: play.hit.with(at, { t, lane }),
    hits: play.hits + 1,
    energy,
  };
  return {
    state,
    events: [
      { type: 'hit', note: at, lane, grade, soundAt: Math.max(t, note.t) },
      ...energyEvents(play.energy, energy),
      ...starEvents(state, at),
    ],
  };
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

/** A release first finishes each soft hold that reached its half point by `t`, so a release between 2 frames counts. */
const release = (play: PlayState, { t, pointerId }: Extract<Action, { type: 'release' }>): Outcome => {
  if (!play.holding.has(pointerId)) {
    return { state: play, events: [] };
  }
  const held = finishHolds(play, t);
  const holding = new Map(held.state.holding);
  holding.delete(pointerId);
  return { state: { ...held.state, holding }, events: held.events };
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
    events.push({ type: 'faded', note: at }, ...energyEvents(before, energy), ...starEvents(play, at));
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
      return release(play, action);
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

/** The score of the play: notes hit divided by the notes in the child chart plus the empty taps. Null after `quit`. */
export const result = (play: PlayState): number | null => {
  if (play.quit) {
    return null;
  }
  const total = play.chart.notes.length + play.emptyCount;
  return total === 0 ? 0 : play.hits / total;
};

/** The song time of the first note of the play, or Infinity for a chart with no note. */
export const firstNoteTime = (play: PlayState): number => play.chart.notes[0]?.t ?? Number.POSITIVE_INFINITY;
