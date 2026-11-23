// How the screen follows one action of the play model and its events, on the play screen and in the frozen play of
// the demo route: the view remembers the events, the band energy records each step change, and an advance moves the
// view to its song time.

import type { Action, EnergyStep, PlayEvent } from '../../model';
import type { EnergyTrack } from './energy';
import type { LiveView } from './view';

export type Followers = {
  readonly view: LiveView;
  /** The band energy, or undefined when the screen shows a fixed step (the demo route with a step in its query). */
  readonly energy: EnergyTrack | undefined;
  /** A step up of the band energy at song time `t`. A step up never goes to step 0. */
  readonly stepUp: (step: Exclude<EnergyStep, 0>, t: number) => void;
};

/** The song time of an action. A quit has no time and no event. */
export const actionTime = (action: Action): number => ('t' in action ? action.t : 0);

/** Records an energy event at song time `t`, and calls `stepUp` for a step up. */
const energize = (followers: Followers, event: PlayEvent, t: number): void => {
  const step = event.type === 'energy' ? event.step : undefined;
  if (step !== undefined && followers.energy?.record(step, t) === true && step !== 0) {
    followers.stepUp(step, t);
  }
};

/** Follows `action` and its `events`. */
export const follow = (followers: Followers, action: Action, events: readonly PlayEvent[]): void => {
  const t = actionTime(action);
  followers.view.track(action, events, t);
  for (const event of events) {
    energize(followers, event, t);
  }
  if (action.type === 'advance') {
    followers.view.update(t);
  }
};
