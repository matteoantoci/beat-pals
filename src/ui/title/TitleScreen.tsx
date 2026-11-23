import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { checkForUpdate, openSafeWindow } from '../../shell/update';
import { playTitleMusic } from '../../sound';
import { palPicture, type PalIndex } from '../pals/pal-svg';
import { ParentCheck } from '../parent/ParentCheck';
import { Logo } from './logo';
import { songsReady } from './songs-ready';
import type { JSX } from 'solid-js';

// The title screen (spec, "Screens"): the logo, the wordmark, the play button, and the 3 pals on the stage floor.
// The first tap unlocks the audio (src/sound listens to the pointer events on the document) and starts the title
// music. With a ready song, one tap anywhere makes the pals hop in the happy state, and the song list opens after
// START_MS. The music plays on in the song list. With no ready song, the play button does not show, and a tap only
// starts the music, so the child never sees an empty song list.
// Before the first touch, the screen is a safe point for an app update.
// A 3-second hold on the logo shows the parent check, and its release does not start the game.

/** The time of the hop before the song list opens. */
const START_MS = 500;

const PALS: readonly PalIndex[] = [0, 1, 2];

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

/** The play button: a sign only, because a tap anywhere on the screen starts the game. */
const PlaySign = (): JSX.Element => (
  <span class="title-play" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path d="M6 3.5 L20 12 L6 20.5 Z" />
    </svg>
  </span>
);

export const TitleScreen = (props: TitleProps): JSX.Element => {
  const [checking, setChecking] = createSignal(false);
  const [going, setGoing] = createSignal(false);
  const ready = songsReady();
  let timer: number | undefined;
  onMount(watchSafePoint);
  onCleanup(() => clearTimeout(timer));
  // While the parent check shows (also at the release of the logo hold), a tap belongs to the check.
  const start = (): void => {
    if (checking() || going()) {
      return;
    }
    playTitleMusic();
    if (ready()) {
      setGoing(true);
      timer = window.setTimeout(() => props.onStart(), START_MS);
    }
  };
  return (
    <main class="title stage-backdrop" classList={{ 'title-go': going() }} onPointerUp={start}>
      <div class="title-brand">
        <Logo onHold={() => setChecking(true)} />
        <h1 class="title-word">
          Beat <span>Pals</span>
        </h1>
      </div>
      <Show when={ready()}>
        <PlaySign />
      </Show>
      <div class="pal-band title-band" aria-hidden="true">
        <For each={PALS}>
          {(index) => (
            <span class="band-pal">
              <img src={palPicture(index, going() ? 'happy' : 'idle')} alt="" draggable={false} />
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
