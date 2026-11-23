import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { checkForUpdate, openSafeWindow } from '../../shell/update';
import { playTitleMusic } from '../../sound';
import { ParentCheck } from '../parent/ParentCheck';
import { Logo } from './logo';
import type { JSX } from 'solid-js';

// The title screen (spec, "Screens"): the logo and the title music. One tap anywhere starts the game: the tap
// unlocks the audio (src/sound listens to the pointer events on the document), starts the title music, and opens
// the song list. The music plays on in the song list.
// Before the first touch, the screen is a safe point for an app update.
// A 3-second hold on the logo shows the parent check, and its release does not start the game.

export type TitleProps = {
  /** A tap on the screen: open the song list. */
  readonly onStart: () => void;
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

export const TitleScreen = (props: TitleProps): JSX.Element => {
  const [checking, setChecking] = createSignal(false);
  onMount(watchSafePoint);
  // While the parent check shows (also at the release of the logo hold), a tap belongs to the check.
  const start = (): void => {
    if (!checking()) {
      playTitleMusic();
      props.onStart();
    }
  };
  return (
    <main class="title" onPointerUp={start}>
      <Logo onHold={() => setChecking(true)} />
      <Show when={checking()}>
        <ParentCheck onPass={() => props.onParent()} onClose={() => setChecking(false)} />
      </Show>
    </main>
  );
};
