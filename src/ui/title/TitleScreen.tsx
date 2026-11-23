import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { checkForUpdate, openSafeWindow } from '../../shell/update';
import { playTitleMusic, stopTitleMusic } from '../../sound';
import { ParentCheck } from '../parent/ParentCheck';
import { Logo } from './logo';
import type { JSX } from 'solid-js';

// The title screen (spec, "Screens"): the logo and the title music. The first tap unlocks the audio (src/sound
// listens to the pointer events on the document) and starts the title music.
// Before the first touch, the screen is a safe point for an app update.
// A 3-second hold on the logo shows the parent check.

export type TitleProps = {
  /** The parent check is passed: open the parent area. */
  readonly onParent: () => void;
};

/** A return of the page to the front: look for a new version. In the safe window, it then applies. */
const onVisible = (): void => {
  if (document.visibilityState === 'visible') {
    checkForUpdate();
  }
};

/** Keeps the safe window open until the first touch, and looks for a new version when the page shows again. */
const watchSafePoint = (): void => {
  const closeSafeWindow = openSafeWindow();
  document.addEventListener('pointerdown', closeSafeWindow, { capture: true, once: true, passive: true });
  document.addEventListener('visibilitychange', onVisible);
  onCleanup(() => {
    closeSafeWindow();
    document.removeEventListener('pointerdown', closeSafeWindow, { capture: true });
    document.removeEventListener('visibilitychange', onVisible);
  });
};

/** Each tap starts the music again if it does not play, for example after a new audio context. */
const watchTaps = (): void => {
  document.addEventListener('pointerup', playTitleMusic, { passive: true });
  onCleanup(() => {
    document.removeEventListener('pointerup', playTitleMusic);
    stopTitleMusic();
  });
};

export const TitleScreen = (props: TitleProps): JSX.Element => {
  const [checking, setChecking] = createSignal(false);
  onMount(() => {
    watchSafePoint();
    watchTaps();
  });
  return (
    <main class="title">
      <Logo onHold={() => setChecking(true)} />
      <Show when={checking()}>
        <ParentCheck onPass={() => props.onParent()} onClose={() => setChecking(false)} />
      </Show>
    </main>
  );
};
