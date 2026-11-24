// How the screen follows one action of the play model and its events, on the play screen and in the frozen play of
// the demo route: the view remembers the events, the band energy records each step change, and an advance moves the
// view to its song time. A star moment and a step up from the same action play only the star moment sound.

import type { Action, EnergyStep, PlayEvent } from '../../model';
import type { EnergyTrack } from './energy';
import type { LiveView } from './view';

export type Followers = {
  readonly view: LiveView;
  /** The band energy, or undefined when the screen shows a fixed step (the demo route with a step in its query). */
  readonly energy: EnergyTrack | undefined;
  /** The sound of a step up of the band energy at song time `t`. A step up never goes to step 0. */
  readonly stepUp: (step: Exclude<EnergyStep, 0>, t: number) => void;
  /** The sound of a star moment at song time `t`. */
  readonly starMoment: (t: number) => void;
};

/** The song time of an action. A quit has no time and no event. */
export const actionTime = (action: Action): number => ('t' in action ? action.t : 0);

/** Made one time, so a frame makes no function (C20). */
const isStarMoment = (event: PlayEvent): boolean => event.type === 'starMoment';

/** The song time of the events that `follow` handles, and whether a star moment silences a step up among them. One
 * object serves each call, so a frame makes no object (C20). */
const moment = { t: 0, quiet: false };

/** Plays the sound of a star moment, or records an energy event and plays the sound of a step up unless `quiet`. */
const followEvent = (followers: Followers, event: PlayEvent): void => {
  if (event.type === 'starMoment') {
    followers.starMoment(moment.t);
    return;
  }
  const step = event.type === 'energy' ? event.step : undefined;
  if (step !== undefined && followers.energy?.record(step, moment.t) === true && step !== 0 && !moment.quiet) {
    followers.stepUp(step, moment.t);
  }
};

/** Follows `action` and its `events`. */
export const follow = (followers: Followers, action: Action, events: readonly PlayEvent[]): void => {
  const t = actionTime(action);
  followers.view.track(action, events, t);
  moment.t = t;
  moment.quiet = events.some(isStarMoment);
  for (const event of events) {
    followEvent(followers, event);
  }
  if (action.type === 'advance') {
    followers.view.update(t);
  }
};
