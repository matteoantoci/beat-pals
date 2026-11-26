// A player for the tests (spec, "Testing Decisions"). It builds a script of `press` and `release` actions from a
// child chart: an offset and a lane for each note, a hold share for each soft hold, and extra taps. Then it plays the script
// through `apply`, with an `advance` to the time of each action, as the play screen does at each frame. It uses only
// the public interface. Not a test file: vitest does not collect it. The app does not import it; only the demo route
// of the dev and smoke builds does (src/ui/demo/), to play the demo chart up to its frozen time.

import { apply, startPlay } from '../index';
import type { Action, ChildChart, EmptyTaps, Lane, PlayEvent, PlayState } from '../index';

/** How the player taps. */
type Touches = {
  /** The tap time minus the note time for the note at this index, in seconds, or null for no tap. Default: 0. */
  readonly offset?: (note: number) => number | null;
  /** The share of a soft hold that the finger stays down, from 0 to 1. Default: 1. */
  readonly hold?: (note: number) => number;
  /** The lane of the tap for the note at this index. Default: the first lane of the note. */
  readonly lane?: (note: number) => Lane;
  /** Taps that are not for a note: the song time and the lane. */
  readonly extra?: readonly { readonly t: number; readonly lane: Lane }[];
};

/** The result of a play: the events in order, and the state at the end. */
type Played = { readonly events: readonly PlayEvent[]; readonly end: PlayState };

/** A plain tap stays down this long. */
const TAP_SEC = 0.05;
/** The script ends this long after the last note, so the last note can pass. */
const END_SEC = 1;

type Tap = { readonly t: number; readonly lane: Lane; readonly up: number };

type Input = Extract<Action, { type: 'press' | 'release' }>;

/** At the same time, a release comes before a press, as on a screen: a finger lifts, then the next one lands. */
const ORDER: Readonly<Record<Input['type'], number>> = { release: 0, press: 1 };

/** The taps for the notes of the chart. */
const noteTaps = (chart: ChildChart, touches: Touches): Tap[] =>
  chart.notes.flatMap((note, at) => {
    const offset = touches.offset === undefined ? 0 : touches.offset(at);
    if (offset === null) {
      return [];
    }
    const t = note.t + offset;
    const held = note.holdSec * (touches.hold === undefined ? 1 : touches.hold(at));
    const lane = touches.lane === undefined ? note.lanes[0] : touches.lane(at);
    return [{ t, lane, up: t + Math.max(TAP_SEC, held) }];
  });

/**
 * The script of a play: a `press` and a `release` for each tap, in time order, each after an `advance` to its time.
 * A release comes before a press at the same time. The script ends with an `advance` past the last note.
 */
export const playScript = (chart: ChildChart, touches: Touches = {}): Action[] => {
  const extra = (touches.extra ?? []).map(({ t, lane }) => ({ t, lane, up: t + TAP_SEC }));
  const taps = [...noteTaps(chart, touches), ...extra].toSorted((a, b) => a.t - b.t);
  const inputs = taps
    .flatMap((tap, pointerId): Input[] => [
      { type: 'press', t: tap.t, lane: tap.lane, pointerId },
      { type: 'release', t: tap.up, pointerId },
    ])
    .toSorted((a, b) => a.t - b.t || ORDER[a.type] - ORDER[b.type]);
  const last = Math.max(...chart.notes.map((note) => note.t), ...inputs.map((input) => input.t));
  return [
    ...inputs.flatMap((input): Action[] => [{ type: 'advance', t: input.t }, input]),
    { type: 'advance', t: last + END_SEC },
  ];
};

/** Plays the actions in order from the start of a play. */
export const playActions = (play: PlayState, actions: readonly Action[]): Played =>
  actions.reduce<Played>(
    (sofar, action) => {
      const outcome = apply(sofar.end, action);
      return { events: [...sofar.events, ...outcome.events], end: outcome.state };
    },
    { events: [], end: play }
  );

/** Plays the chart with these touches, from the start to past the last note. By default the 'other-lane' rule judges. */
export const playOut = (chart: ChildChart, touches: Touches = {}, emptyTaps: EmptyTaps = 'other-lane'): Played =>
  playActions(startPlay(chart, emptyTaps), playScript(chart, touches));
