import { createSignal, onSettled, Show } from 'solid-js';
import { playTitleMusic } from '../../sound';
import { NightTitle } from '../title/NightTitle';
import { TitleScreen } from '../title/TitleScreen';
import { TitleToNight } from './TitleToNight';
import { WakeScene } from './WakeScene';
import type { SessionStatus } from '../../model';
import type { SessionController } from './controller';
import type { JSX } from '@solidjs/web';
import type { Accessor } from 'solid-js';

// The title screen of the app (src/ui/App.tsx) in the play sessions (play-sessions spec, "Night title and
// wake-up"): the night title while the pals sleep, the wake-up scene, or the normal title. While the normal title
// shows, the session applies the start conditions (session-schedule spec, "Can a session start"). When they put the
// pals to sleep, the title fades to the night title (./TitleToNight.tsx).

/** The wake-up scene that plays on the title screen: `restTimeOver` tells if the rest time was over before it. */
type Waking = { readonly restTimeOver: boolean };

type WakeRoutes = {
  readonly waking: Accessor<Waking | undefined>;
  readonly endWake: () => void;
  readonly wake: () => void;
  readonly openParent: () => void;
  /** "Open a new session now" in the parent area. Gives the status after it. */
  readonly openNow: () => SessionStatus;
  readonly closeParent: () => void;
};

/** The wake-up scene: a tap on the night title after the rest time, or "Open a new session now" in the parent area.
 * At its end, the normal title shows and the title music starts. The routes decide from the answers of `send`. */
export const wakeRoutes = (session: SessionController, go: (next: 'parent' | 'title') => void): WakeRoutes => {
  const [waking, setWaking] = createSignal<Waking>();
  /** The wake-up scene after "Open a new session now", for the close of the parent area. */
  let woken: Waking | undefined;
  return {
    waking,
    endWake: () => {
      setWaking();
      playTitleMusic();
    },
    wake: () => {
      // A wake-tap wakes the pals only after the rest time.
      if (session.send('wake-tap').state.kind !== 'asleep') {
        setWaking({ restTimeOver: true });
      }
    },
    openParent: () => go('parent'),
    openNow: () => {
      const restTimeOver = session.status().kind === 'rest-time-over';
      // The parent area shows the button only while the pals sleep, so an awake answer is a wake-up.
      if (session.send('open-now').state.kind !== 'asleep') {
        woken = { restTimeOver };
      }
      return session.status();
    },
    closeParent: () => {
      if (woken) {
        setWaking(woken);
        woken = undefined;
      }
      go('title');
    },
  };
};

/** The normal title. While it shows, the session knows it, so the start conditions apply also while it shows. */
const AwakeTitle = (props: {
  readonly session: SessionController;
  readonly onStart: () => void;
  readonly onParent: () => void;
}): JSX.Element => {
  onSettled(() => {
    props.session.title(true);
    return () => props.session.title(false);
  });
  return <TitleScreen onStart={props.onStart} onParent={props.onParent} />;
};

/** The title screen: the wake-up scene, the night title while the pals sleep, or the normal title. */
export const Title = (props: {
  readonly session: SessionController;
  readonly routes: WakeRoutes;
  readonly onStart: () => void;
}): JSX.Element => {
  const night = (): JSX.Element => (
    <NightTitle
      restTimeOver={props.session.restTimeOver()}
      onWake={props.routes.wake}
      onParent={props.routes.openParent}
    />
  );
  return (
    <Show
      when={props.routes.waking()}
      keyed
      fallback={
        <Show
          when={props.session.state().kind === 'asleep'}
          fallback={<AwakeTitle session={props.session} onStart={props.onStart} onParent={props.routes.openParent} />}
        >
          <Show when={props.session.toNight()} fallback={night()}>
            <TitleToNight>{night()}</TitleToNight>
          </Show>
        </Show>
      }
    >
      {(scene) => <WakeScene restTimeOver={scene.restTimeOver} onDone={props.routes.endWake} />}
    </Show>
  );
};
