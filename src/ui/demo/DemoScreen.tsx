import { createSignal, onSettled, Show } from 'solid-js';
import { createPlay } from '../play/play-load';
import { PlayLayers, playRefs } from '../play/PlayLayers';
import demoCss from './demo.css?inline';
import { Device } from './Device';
import { frozenPlay } from './frozen-play';
import { DEMO_MARKER } from './marker';
import { readDemo } from './params';
import type { JSX } from '@solidjs/web';

// The demo route of the dev server and the smoke build (spec, "Testing Decisions"): the play screen of the demo song,
// frozen at one song time, for the screenshots of the checklist C1 to C30. It shows the play layers (PlayLayers.tsx)
// with the frozen play (frozen-play.ts). It draws one frame, plays no sound, and writes no save. When the frame
// shows, the screen gets `data-demo-ready`.

const nothing = (): void => undefined;

export const DemoScreen = (props: { readonly search: string }): JSX.Element => {
  const read = readDemo(props.search);
  const [failure, setFailure] = createSignal(read.ok ? '' : read.reason);
  const sim = read.ok && read.demo.sim;
  const refs = playRefs();
  onSettled(() => {
    const elements = refs.elements();
    if (!read.ok || elements === undefined) {
      return undefined;
    }
    const play = createPlay(frozenPlay(elements, read.demo), {
      onLoad: nothing,
      onLoaded: () => Promise.resolve(),
      onStarted: () => elements.root.setAttribute('data-demo-ready', ''),
      onFail: ({ problem }) => setFailure(`The demo did not load: ${problem}.`),
      onPause: nothing,
      onEnd: nothing,
    });
    return play.dispose;
  });
  return (
    <main class={sim ? 'play demo-sim' : 'play'} data-demo={DEMO_MARKER} ref={refs.root}>
      <style>{demoCss}</style>
      <PlayLayers refs={refs} onPause={nothing} />
      <Show when={sim}>
        <Device />
      </Show>
      <Show when={failure()}>
        <p class="demo-failure">{failure()}</p>
      </Show>
    </main>
  );
};
