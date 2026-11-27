import { onSettled } from 'solid-js';
import { PlaySessions } from '../../../parent/PlaySessions';
import type { SessionScreenProps, SessionScreens } from '../registry';
import type { JSX } from '@solidjs/web';

// The `parent` screen of the session demo: the parent area with the "Play sessions" section while the pals sleep.
// "Open a new session now" works on this screen, and the settings change only the screen. The screen has no
// animation, so `t` and `reduce` change nothing.

const ParentScreen = (props: SessionScreenProps): JSX.Element => {
  onSettled(props.ready);
  return (
    <main class="parent-area">
      <header class="parent-bar">
        <h1>Parent area</h1>
        <button type="button">Done</button>
      </header>
      <PlaySessions
        status={{ kind: 'asleep', minutesLeft: 80 }}
        settings={{ minutes: 10, perDay: 4 }}
        onSettings={() => undefined}
        onOpenNow={() => ({ kind: 'awake' })}
      />
      <section class="parent-section">
        <h2>Songs</h2>
      </section>
    </main>
  );
};

export const screens: SessionScreens = { parent: ParentScreen };
