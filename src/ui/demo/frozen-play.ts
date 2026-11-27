// The frozen adapter of the play lifetime (src/ui/play/play-load.ts) for the demo route: the stage and the pals of
// the demo song, frozen at the song time of the query (frozen.ts). It decodes the generated click only for the song
// length, plays no sound, and writes no save. Its start draws one frame and fills the progress beads; a turn of the
// device draws the frame again.

import { childChart, playSetup } from '../../model';
import { loadSong } from '../../sound';
import { fillBeads, fullBeads } from '../play/beads';
import { stagePorts, type PlayElements } from '../play/fit';
import { clickTrack } from './click';
import { demoFacts } from './fixture';
import { freeze, type Frozen } from './frozen';
import type { Pals } from '../play/pals';
import type { PlayAdapter, StartedPlay } from '../play/play-load';
import type { Stage } from '../play/stage';
import type { Demo } from './params';

type FrozenParts = {
  readonly stage: Stage;
  readonly pals: Pals;
  readonly frozen: Frozen;
  /** The length of the decoded click in seconds. */
  readonly duration: number;
};

const nothing = (): void => undefined;
const STILL: StartedPlay = { pause: nothing, resume: nothing, quit: nothing, stop: nothing };

/** The song length: the decoded length of the generated click, as a play uses the decoded song. */
const songLength = async (beats: readonly number[]): Promise<number> => {
  const song = await loadSong(clickTrack(beats), { onReplaced: nothing, onInterrupted: nothing }, false);
  const { duration } = song;
  song.release();
  return duration;
};

export const frozenPlay = (elements: PlayElements, demo: Demo): PlayAdapter<FrozenParts> => {
  let draw = nothing;
  const ports = stagePorts(elements, () => draw());
  return {
    load: async (scope) => {
      const facts = demoFacts();
      const chart = childChart(facts, playSetup(demo.progress));
      const duration = await songLength(facts.beats.map((beat) => beat.t));
      await ports.pictures();
      const stage = await ports.stage(chart.band);
      if (!scope.keep(stage.destroy)) {
        return undefined;
      }
      const { pals, unresize } = ports.arrange(stage, chart.band, facts.beats);
      scope.keep(unresize);
      return { stage, pals, duration, frozen: freeze(chart, facts.beats, demo) };
    },
    start: ({ stage, pals, frozen, duration }) => {
      draw = () => {
        stage.draw(frozen.view, demo.reduce, frozen.energy);
        pals.update(frozen.view, demo.reduce, frozen.energy);
      };
      draw();
      fillBeads(elements.beads, fullBeads(demo.t, duration));
      return STILL;
    },
  };
};
