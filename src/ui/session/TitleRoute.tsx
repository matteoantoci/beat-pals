import { createSignal, Show } from 'solid-js';
import { playTitleMusic } from '../../sound';
import { NightTitle } from '../title/NightTitle';
import { TitleScreen } from '../title/TitleScreen';
import { WakeScene } from './WakeScene';
import type { SessionController } from './controller';
import type { JSX } from '@solidjs/web';
import type { Accessor } from 'solid-js';

// The title screen of the app (src/ui/App.tsx) in the play sessions (play-sessions spec, "Night title and
// wake-up"): the night title while the pals sleep, the wake-up scene, or the normal title.

/** The wake-up scene that plays on the title screen: `restTimeOver` tells if the rest time was over before it. */
type Waking = { readonly restTimeOver: boolean };

type WakeRoutes = {
  readonly waking: Accessor<Waking | undefined>;
  readonly endWake: () => void;
  readonly wake: () => void;
  readonly openParent: () => void;
  readonly closeParent: () => void;
};

/** The wake-up scene: a tap on the night title after the rest time, or "Open a new session now" in the parent area.
 * At its end, the normal title shows and the title music starts. */
export const wakeRoutes = (session: SessionController, go: (next: 'parent' | 'title') => void): WakeRoutes => {
  const [waking, setWaking] = createSignal<Waking>();
  /** The night before the parent area opened, while the pals slept. */
  let nightBefore: Waking | undefined;
  return {
    waking,
    endWake: () => {
      setWaking();
      playTitleMusic();
    },
    wake: () => {
      const restTimeOver = session.restTimeOver();
      // Use the answer: `session.state()` gives the old state until the next flush.
      if (session.send('wake-tap').state.kind !== 'asleep') {
        setWaking({ restTimeOver });
      }
    },
    openParent: () => {
      nightBefore = session.state().kind === 'asleep' ? { restTimeOver: session.restTimeOver() } : undefined;
      go('parent');
    },
    closeParent: () => {
      if (nightBefore && session.state().kind !== 'asleep') {
        setWaking(nightBefore);
      }
      go('title');
    },
  };
};

/** The title screen: the wake-up scene, the night title while the pals sleep, or the normal title. */
export const Title = (props: {
  readonly session: SessionController;
  readonly routes: WakeRoutes;
  readonly onStart: () => void;
}): JSX.Element => (
  <Show
    when={props.routes.waking()}
    keyed
    fallback={
      <Show
        when={props.session.state().kind === 'asleep'}
        fallback={<TitleScreen onStart={props.onStart} onParent={props.routes.openParent} />}
      >
        <NightTitle
          restTimeOver={props.session.restTimeOver()}
          onWake={props.routes.wake}
          onParent={props.routes.openParent}
        />
      </Show>
    }
  >
    {(scene) => <WakeScene restTimeOver={scene.restTimeOver} onDone={props.routes.endWake} />}
  </Show>
);
