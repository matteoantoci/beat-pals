import { onSettled } from 'solid-js';
import { stopTitleMusic } from '../../sound';
import { useStorage } from '../storage';
import { Credits } from './Credits';
import { PlaySessions } from './PlaySessions';
import { Reset } from './Reset';
import { MakeCode, RestoreCode } from './SaveCode';
import { SongsSection } from './SongsSection';
import { SoundSwitch } from './SoundSwitch';
import type { SessionStatus } from '../../model';
import type { SessionController } from '../session/controller';
import type { JSX } from '@solidjs/web';

// The parent area, as in Pile Pals (spec, "Screens"): the "Play sessions" section at the top, the "Songs" section, the Sound effects switch, making and
// restoring the save code, the reset, and the credits. English text is allowed here, because only an adult
// gets in. The title music plays only on the title screen and the song list, so it stops here.

export const ParentArea = (props: {
  readonly session: SessionController;
  /** "Open a new session now": the title screen sends it, because it plays the wake-up scene at the close. */
  readonly onOpenNow: () => SessionStatus;
  readonly onClose: () => void;
}): JSX.Element => {
  onSettled(stopTitleMusic);
  // The session controller reads the settings from the same storage.
  const { session } = useStorage();
  return (
    <main class="parent-area">
      <header class="parent-bar">
        <h1>Parent area</h1>
        <button type="button" onClick={() => props.onClose()}>
          Done
        </button>
      </header>
      <PlaySessions
        status={props.session.status()}
        settings={session.settings()}
        onSettings={session.storeSettings}
        onOpenNow={props.onOpenNow}
      />
      <SongsSection />
      <SoundSwitch />
      <MakeCode />
      <RestoreCode />
      <Reset />
      <Credits />
    </main>
  );
};
