import { createSignal, For, onSettled, Show } from 'solid-js';
import { stopTitleMusic } from '../../sound';
import { SessionPal } from '../pals/SessionPal';
import { ParentCheck } from '../parent/ParentCheck';
import { Logo } from './logo';
import { watchSafePoint } from './safe-point';
import type { PalIndex } from '../pals/pal-svg';
import type { JSX } from '@solidjs/web';

// The night title (play-sessions spec, "Night title and wake-up"): the title screen while the pals sleep. It shows
// the logo, the wordmark, and the pals in the sleep face, with no play button. It plays no title music: it stops the
// music that a hidden gap on the song list left on, and it does not use the tap of the normal title
// (./TitleScreen.tsx), which starts the music. While the rest time runs, a tap does nothing. When the rest time
// ends, the sky turns lighter (`dawn`), and only then does a tap wake the pals.
// The screen is a safe point for an app update (./safe-point.ts). A 3-second hold on the logo shows the parent check.
// This is the plain look; the art of night.css comes later (ticket 07).

const PALS: readonly PalIndex[] = [0, 1, 2];

type NightTitleProps = {
  /** The rest time is over: the sky turns lighter, and a tap wakes the pals. */
  readonly dawn: boolean;
  /** A tap after the rest time. */
  readonly onWake: () => void;
  /** The parent check is passed: open the parent area. */
  readonly onParent: () => void;
};

export const NightTitle = (props: NightTitleProps): JSX.Element => {
  onSettled(() => {
    stopTitleMusic();
    return watchSafePoint();
  });
  const [checking, setChecking] = createSignal(false);
  // While the parent check shows (also at the release of the logo hold), a tap belongs to the check.
  const tap = (): void => {
    if (props.dawn && !checking()) {
      props.onWake();
    }
  };
  return (
    <main class={['title night-title', { 'night-dawn': props.dawn }]} onPointerUp={tap}>
      <div class="title-brand">
        <Logo onHold={() => setChecking(true)} />
        <h1 class="title-word">
          Beat <span>Pals</span>
        </h1>
      </div>
      <div class="pal-band title-band" aria-hidden="true">
        <For each={PALS}>
          {(index) => (
            <span class="night-pal">
              <SessionPal index={index} faces={['sleep']} />
            </span>
          )}
        </For>
      </div>
      <Show when={checking()}>
        <ParentCheck onPass={() => props.onParent()} onClose={() => setChecking(false)} />
      </Show>
    </main>
  );
};
