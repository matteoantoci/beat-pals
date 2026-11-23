import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { childChart, playSetup } from '../../model';
import { loadSong } from '../../sound';
import { decodePals } from '../pals/pal-svg';
import { makePals } from '../play/pals';
import { measure } from '../play/play-load';
import { Hud } from '../play/PlayScreen';
import { createStage } from '../play/stage';
import { clickTrack } from './click';
import demoCss from './demo.css?inline';
import { demoFacts } from './fixture';
import { freeze } from './frozen';
import { DEMO_MARKER } from './marker';
import { readDemo, type Demo } from './params';
import type { JSX } from 'solid-js';

// The demo route of the dev server and the smoke build (spec, "Testing Decisions"): the play screen of the demo song,
// frozen at one song time, for the screenshots of the checklist C1 to C30. It uses the parts of the play screen: the
// stage, the pals, and the HUD. It draws one frame, plays no sound, and writes no save. When the frame shows, the
// screen gets `data-demo-ready`.

const BEADS = 10;
const nothing = (): void => undefined;

type Elements = {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly probe: HTMLElement;
  readonly pals: readonly HTMLImageElement[];
  readonly beads: readonly HTMLElement[];
};

/** The song length: the decoded length of the generated click, as a play uses the decoded song. */
const songLength = async (beats: readonly number[]): Promise<number> => {
  const song = await loadSong(clickTrack(beats), { onReplaced: nothing, onInterrupted: nothing });
  const { duration } = song;
  song.release();
  return duration;
};

/** Draws the frozen frame. Gives the function that frees the stage. */
const show = async (elements: Elements, demo: Demo): Promise<() => void> => {
  const facts = demoFacts();
  const { color, step } = playSetup(demo.progress);
  const chart = childChart(facts, color, step);
  const duration = await songLength(facts.beats.map((beat) => beat.t));
  await decodePals();
  const stage = await createStage(elements.canvas, measure(elements), chart.band);
  const pals = makePals(elements.pals, chart.band, facts.beats);
  const frozen = freeze(chart, facts.beats, demo);
  for (const hop of frozen.hops) {
    pals.hop(hop.lane, hop.t);
  }
  const draw = (): void => {
    stage.draw(frozen.view, demo.reduce, frozen.energy);
    pals.update(frozen.view, demo.reduce, frozen.energy);
  };
  pals.layout(measure(elements));
  draw();
  const full = Math.max(0, Math.min(BEADS, Math.floor((demo.t / duration) * BEADS)));
  elements.beads.forEach((bead, at) => bead.classList.toggle('full', at < full));
  const onResize = (): void => {
    const geometry = measure(elements);
    stage.resize(geometry);
    pals.layout(geometry);
    draw();
  };
  window.addEventListener('resize', onResize);
  return () => {
    window.removeEventListener('resize', onResize);
    stage.destroy();
  };
};

/** The lists of the screen, the demo, and the place for a failure. */
type Mount = Pick<Elements, 'pals' | 'beads'> & { readonly demo: Demo; readonly fail: (reason: string) => void };

/** Shows the frozen frame on the screen. Gives the function that frees it when the screen closes. */
const mount = (root: HTMLElement | undefined, { pals, beads, demo, fail }: Mount): (() => void) => {
  const canvas = root?.querySelector('canvas');
  const probe = root?.querySelector<HTMLElement>('.play-probe');
  if (root === undefined || !canvas || !probe) {
    return nothing;
  }
  let free = nothing;
  let closed = false;
  show({ root, canvas, probe, pals, beads }, demo).then(
    (stop) => {
      free = stop;
      if (closed) {
        stop();
        return;
      }
      root.setAttribute('data-demo-ready', '');
    },
    (error: unknown) => fail(String(error))
  );
  return () => {
    closed = true;
    free();
  };
};

/** The iPhone 12 of `sim`: the notch, the home indicator, and the round screen corners. */
const Device = (): JSX.Element => (
  <div class="demo-device" aria-hidden="true">
    <i class="demo-notch" />
    <i class="demo-home" />
  </div>
);

export const DemoScreen = (props: { readonly search: string }): JSX.Element => {
  const read = readDemo(props.search);
  const [failure, setFailure] = createSignal(read.ok ? '' : read.reason);
  const sim = read.ok && read.demo.sim;
  let root: HTMLElement | undefined;
  const pals: HTMLImageElement[] = [];
  const beads: HTMLElement[] = [];
  onMount(() => {
    if (read.ok) {
      onCleanup(mount(root, { pals, beads, demo: read.demo, fail: setFailure }));
    }
  });
  return (
    <main
      class={sim ? 'play demo-sim' : 'play'}
      data-demo={DEMO_MARKER}
      ref={(el) => {
        root = el;
      }}
    >
      <style>{demoCss}</style>
      <canvas class="play-stage" />
      <For each={[0, 1, 2]}>
        {() => <img class="play-pal" alt="" hidden draggable={false} ref={(el) => pals.push(el)} />}
      </For>
      <div class="play-probe" />
      <Hud onPause={nothing} bead={(el) => beads.push(el)} />
      <Show when={sim}>
        <Device />
      </Show>
      <Show when={failure()}>
        <p class="demo-failure">{failure()}</p>
      </Show>
    </main>
  );
};
