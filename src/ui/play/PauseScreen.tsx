import { HoldButton } from './HoldButton';
import type { JSX } from '@solidjs/web';

// The pause screen (spec, "Screens"): the song stops, and a big play button and a home button show. One tap on play
// continues the song from the same time; that tap also unlocks a new audio context when the old one is stale. Home
// needs a hold of 0.6 s, because it ends the play with no result.

type PauseScreenProps = { readonly onPlay: () => void; readonly onHome: () => void };

export const PauseScreen = (props: PauseScreenProps): JSX.Element => (
  <div class="pause-screen">
    <button type="button" class="pause-play" aria-label="Play" onClick={() => props.onPlay()}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3.5v17a1 1 0 0 0 1.5.9l14-8.5a1 1 0 0 0 0-1.8l-14-8.5A1 1 0 0 0 6 3.5z" />
      </svg>
    </button>
    <HoldButton class="pause-home" label="Home (parent: hold)" onHold={() => props.onHome()}>
      <svg class="pause-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 4l8 7.5V20h-5.5v-5h-5v5H4z" />
      </svg>
    </HoldButton>
  </div>
);
