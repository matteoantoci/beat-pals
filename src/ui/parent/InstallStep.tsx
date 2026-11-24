import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';

// Step 1 of the song setup (spec, "Guided song setup"): in a Safari tab, the songs must not download, because a
// Safari tab has separate storage. So the step shows how to add the app to the Home Screen, with 3 pictures, and
// the next steps stay hidden.

const PICTURES = [
  { file: 'share.svg', text: 'Tap the Share button. It is in the Safari toolbar, or in its ••• menu.' },
  { file: 'add-to-home.svg', text: 'Tap "Add to Home Screen", and then "Add".' },
  { file: 'open-app.svg', text: 'Open Beat Pals from the Home Screen, and set up the songs there.' },
] as const;

export const InstallStep = (): JSX.Element => (
  <>
    <p class="song-install-title">Add Beat Pals to your Home Screen first</p>
    <ol class="song-install">
      <For each={PICTURES}>
        {(picture) => (
          <li>
            <img src={`${import.meta.env.BASE_URL}setup/${picture.file}`} alt="" draggable="false" />
            <span>{picture.text}</span>
          </li>
        )}
      </For>
    </ol>
  </>
);
