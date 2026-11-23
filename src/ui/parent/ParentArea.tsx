import { onMount } from 'solid-js';
import { stopTitleMusic } from '../../sound';
import { SongsSection } from './SongsSection';
import type { JSX } from 'solid-js';

// The parent area. English text is allowed here, because only an adult gets in. The title music plays only on the
// title screen and the song list, so it stops here.
// Later tickets add the other sections (spec, "Screens").

export const ParentArea = (props: { readonly onClose: () => void }): JSX.Element => {
  onMount(stopTitleMusic);
  return (
    <main class="parent-area">
      <header class="parent-bar">
        <h1>Parent area</h1>
        <button type="button" onClick={() => props.onClose()}>
          Done
        </button>
      </header>
      <SongsSection />
    </main>
  );
};
