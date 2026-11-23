// The frozen play of the demo route (spec, "Testing Decisions"): the test player plays the child chart up to the
// song time `t`, with each tap on its note, through the play model. The view and the band energy follow each action
// as on the play screen (`follow`), and then stop at `t`. A step in the query replaces the energy that the play
// reached; it changed long enough before `t` that its lasting effects show fully, with no level-up moment.

import { apply, startPlay } from '../../model';
import { playScript } from '../../model/play/test-player';
import { makeEnergyTrack, type EnergyLook } from '../play/energy';
import { actionTime, follow } from '../play/follow';
import { makeView, type View } from '../play/view';
import type { Action, ChildChart, EnergyStep, SongFacts } from '../../model';

/** Longer than the fade of a lasting effect (0.8 s) and the gold level-up moment (1.1 s). */
const SETTLE_SEC = 1.2;

export type Frozen = { readonly view: View; readonly energy: EnergyLook };

export const freeze = (
  chart: ChildChart,
  beats: SongFacts['beats'],
  { t, energy }: { readonly t: number; readonly energy: EnergyStep | undefined }
): Frozen => {
  const view = makeView(chart, beats);
  const track = makeEnergyTrack();
  const followers = { view, energy: energy === undefined ? track : undefined, stepUp: () => undefined };
  const actions: Action[] = [...playScript(chart).filter((action) => actionTime(action) <= t), { type: 'advance', t }];
  actions.reduce((play, action) => {
    const { state, events } = apply(play, action);
    follow(followers, action, events);
    return state;
  }, startPlay(chart));
  if (energy !== undefined) {
    track.record(energy, t - SETTLE_SEC);
  }
  return { view: view.view(), energy: track.at(t) };
};
