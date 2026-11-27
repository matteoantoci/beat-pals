import { createSignal, Show } from 'solid-js';
import { TitleFace } from '../title/TitleScreen';
import type { JSX } from '@solidjs/web';

// The cross-fade from the title to the night title (session-schedule spec, "Can a session start"): when the day
// budget is used or the last start time of the evening is past, the night title fades in over the picture of the
// title in 2 s (title.css), with no goodbye scene and no sound. Reduced motion gives the same fade. The picture of the
// title has no taps and no safe point, and it goes away at the end of the fade. The night title is the child.

export const TitleToNight = (props: { readonly children: JSX.Element }): JSX.Element => {
  const [faded, setFaded] = createSignal(false);
  const end = (event: AnimationEvent): void => {
    // The animations of the night title also bubble up to this layer.
    if (event.target === event.currentTarget) {
      setFaded(true);
    }
  };
  return (
    <div class="title-to-night">
      <Show when={!faded()}>
        <div class="title-to-night-title" aria-hidden="true">
          <TitleFace going={false} ready />
        </div>
      </Show>
      <div class="title-to-night-night" onAnimationEnd={end}>
        {props.children}
      </div>
    </div>
  );
};
