// The frozen play of the demo route (spec, "Testing Decisions"): the test player plays the child chart up to the
// song time `t`, with each tap on its note, through the play model. The view and the band energy follow each action
// as on the play screen, and then stop at `t`. A step in the query replaces the energy that the play reached; it
// changed long enough before `t` that its lasting effects show fully, with no level-up moment.

import { apply, startPlay } from '../../model';
import { playScript } from '../../model/play/test-player';
import { makeEnergyTrack, type EnergyLook, type EnergyStep } from '../play/energy';
import { makeView, type View } from '../play/view';
import type { Action, ChildChart, Lane, SongFacts } from '../../model';

/** Longer than the fade of a lasting effect (0.8 s) and the gold level-up moment (1.1 s). */
const SETTLE_SEC = 1.2;

export type Frozen = {
  readonly view: View;
  readonly energy: EnergyLook;
  /** The hops of the waiting pals: the lane and the song time. */
  readonly hops: readonly { readonly lane: Lane; readonly t: number }[];
};

const timeOf = (action: Action): number => ('t' in action ? action.t : 0);

export const freeze = (
  chart: ChildChart,
  beats: SongFacts['beats'],
  { t, energy }: { readonly t: number; readonly energy: EnergyStep | undefined }
): Frozen => {
  const live = makeView(chart, beats);
  const track = makeEnergyTrack();
  const hops: { lane: Lane; t: number }[] = [];
  const actions: Action[] = [...playScript(chart).filter((action) => timeOf(action) <= t), { type: 'advance', t }];
  actions.reduce((play, action) => {
    const at = timeOf(action);
    const { state, events } = apply(play, action);
    live.track(action, events, at);
    hops.push(...events.flatMap((event) => (event.type === 'hop' ? [{ lane: event.lane, t: at }] : [])));
    const steps = energy === undefined ? events.flatMap((event) => (event.type === 'energy' ? [event.step] : [])) : [];
    for (const step of steps) {
      track.record(step, at);
    }
    if (action.type === 'advance') {
      live.update(at);
    }
    return state;
  }, startPlay(chart));
  if (energy !== undefined) {
    track.record(energy, t - SETTLE_SEC);
  }
  return { view: live.view(), energy: track.at(t), hops };
};
