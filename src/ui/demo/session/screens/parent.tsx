import { onSettled } from 'solid-js';
import { DEFAULT_SESSION_SETTINGS } from '../../../../model';
import { PlaySessions } from '../../../parent/PlaySessions';
import type { SessionScreenProps, SessionScreens } from '../registry';
import type { JSX } from '@solidjs/web';

// The `parent` screen of the session demo: the parent area with the "Play sessions" section while the pals sleep
// until the next day start.
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
        status={{ kind: 'asleep', minutesLeft: 500, untilDayStart: true }}
        settings={DEFAULT_SESSION_SETTINGS}
        onSettings={() => undefined}
        onOpenNow={() => ({ kind: 'awake', usedTodayMinutes: 45, dayMinutes: 45, byParent: true })}
      />
      <section class="parent-section">
        <h2>Songs</h2>
      </section>
    </main>
  );
};

export const screens: SessionScreens = { parent: ParentScreen };
