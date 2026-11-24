import { onSettled } from 'solid-js';
import { stopTitleMusic } from '../../sound';
import { Credits } from './Credits';
import { Reset } from './Reset';
import { MakeCode, RestoreCode } from './SaveCode';
import { SongsSection } from './SongsSection';
import { SoundSwitch } from './SoundSwitch';
import type { JSX } from '@solidjs/web';

// The parent area, as in Pile Pals (spec, "Screens"): the "Songs" section, the Sound effects switch, making and
// restoring the save code, the reset, and the credits. English text is allowed here, because only an adult
// gets in. The title music plays only on the title screen and the song list, so it stops here.

export const ParentArea = (props: { readonly onClose: () => void }): JSX.Element => {
  onSettled(stopTitleMusic);
  return (
    <main class="parent-area">
      <header class="parent-bar">
        <h1>Parent area</h1>
        <button type="button" onClick={() => props.onClose()}>
          Done
        </button>
      </header>
      <SongsSection />
      <SoundSwitch />
      <MakeCode />
      <RestoreCode />
      <Reset />
      <Credits />
    </main>
  );
};
