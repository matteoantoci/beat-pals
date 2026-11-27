import { createSignal } from 'solid-js';
import { loadSoundOn, storeSoundOn } from '../../shell/settings';
import type { JSX } from '@solidjs/web';

// The Sound effects switch of the parent area (spec, "Save" and "Sound"). It turns off the claps, the level-up
// sounds, the end scene sounds, and the sounds of the session scenes (the sun and the sleep) from the next scene on.
// The songs and the title music always play.

export const SoundSwitch = (): JSX.Element => {
  const [on, setOn] = createSignal(loadSoundOn());
  const flip = (): void => {
    const next = !on();
    storeSoundOn(next);
    setOn(next);
  };
  return (
    <section class="parent-section sound-section">
      <h2>Sound</h2>
      <button type="button" class="parent-switch" role="switch" aria-checked={on() ? 'true' : 'false'} onClick={flip}>
        Sound effects: {on() ? 'On' : 'Off'}
      </button>
      <p>
        The claps, the level-up sounds, the end of song sounds, and the sounds of the sun and the sleep. The songs and
        the title music always play.
      </p>
    </section>
  );
};
