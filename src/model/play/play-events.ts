// The inputs and the outputs of the play model (spec, "Play model interface"): the actions of the play screen and
// the events that the play screen shows and plays.

import type { ChildChart } from '../child/child-chart';
import type { EnergyStep } from './energy';

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
  /** A tap in `lane` hit the note `note` (index in the child chart). The clap plays at `soundAt`: the note time for
   * an early tap, the tap time for a late tap. */
  | {
      readonly type: 'hit';
      readonly note: number;
      readonly lane: Lane;
      readonly grade: 'great' | 'good';
      readonly soundAt: number;
    }
  /** A tap in the lane of a waiting pal: the pal hops. */
  | { readonly type: 'hop'; readonly lane: Lane }
  /** The good window of the note ended with no hit. `note` is the index in the child chart. */
  | { readonly type: 'faded'; readonly note: number }
  /** The finger stayed down to the half point of the soft hold. `note` is the index in the child chart. */
  | { readonly type: 'holdDone'; readonly note: number }
  /** The band energy changed to this step. */
  | { readonly type: 'energy'; readonly step: EnergyStep }
  /** The last note of phrase `phrase` (index in the child chart) was hit or passed, and at least 75% of the notes of
   * the phrase were hit. */
  | { readonly type: 'starMoment'; readonly phrase: number };
