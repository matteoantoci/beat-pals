import { createSignal } from 'solid-js';
import { loadSoundOn, storeSoundOn } from '../../shell/settings';
import type { JSX } from 'solid-js';

// The Sound effects switch of the parent area (spec, "Save" and "Sound"). It turns off the claps and the level-up
// sounds from the next song on. The songs and the title music always play.

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
      <button type="button" class="parent-switch" role="switch" aria-checked={on()} onClick={flip}>
        Sound effects: {on() ? 'On' : 'Off'}
      </button>
      <p>The claps and the level-up sounds. The songs and the title music always play.</p>
    </section>
  );
};
