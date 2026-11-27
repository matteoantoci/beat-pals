import { createSignal, Show } from 'solid-js';
import { readSaveCode, saveCode } from '../../model';
import { useStorage } from '../storage';
import type { RestoreFailure } from '../../model';
import type { JSX } from '@solidjs/web';

// How to make and restore the save code (spec, "Save"; user story 46). The code holds the progress of the device
// storage, in the save format of this build (`snapshot`, `restore`). It is not encrypted.

const REFUSED: Readonly<Record<RestoreFailure, string>> = {
  version: 'This save code is from a different version of Beat Pals. It cannot be read.',
  shape: 'This is not a save code. Paste the full code.',
};

const songs = (count: number): string => `${String(count)} ${count === 1 ? 'song' : 'songs'}`;

/** Makes the code of the progress and shows it, with a copy button. */
export const MakeCode = (): JSX.Element => {
  const storage = useStorage();
  const [code, setCode] = createSignal('');
  const [note, setNote] = createSignal('');
  const make = async (): Promise<void> => {
    const save = storage.save.current();
    if (Object.keys(save.progress).length === 0) {
      setNote('No song has a play yet, so there is no progress to save.');
      return;
    }
    setCode(await saveCode(save));
    setNote('Keep this code in a safe place, for example in a note.');
  };
  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(code());
    setNote('The code is copied.');
  };
  return (
    <section class="parent-section save-new">
      <h2>Make a save code</h2>
      <p>The save code holds the progress: the stars and the record color of each song.</p>
      <p class="save-code-note">This code lists the songs on this device.</p>
      <button
        type="button"
        class="save-make"
        onClick={() => {
          make().catch(() => setNote('The save code could not be made.'));
        }}
      >
        Make save code
      </button>
      <Show when={code() !== ''}>
        <textarea class="parent-code" readonly rows="5" value={code()} aria-label="Save code" />
        <button
          type="button"
          onClick={() => {
            copy().catch(() => setNote('Copy did not work. Select the code and copy it.'));
          }}
        >
          Copy
        </button>
      </Show>
      <p class="parent-note" aria-live="polite">
        {note()}
      </p>
    </section>
  );
};

/** Reads a pasted save code and replaces the progress of this device with the progress of the code. */
export const RestoreCode = (): JSX.Element => {
  const { save } = useStorage();
  const [text, setText] = createSignal('');
  const [note, setNote] = createSignal('');
  const run = async (): Promise<void> => {
    const result = await readSaveCode(text());
    if (!result.ok) {
      setNote(REFUSED[result.reason]);
      return;
    }
    if (!save.replace(result.progress)) {
      setNote('The progress is restored until the app closes. It could not be saved on this device.');
      return;
    }
    setText('');
    setNote(`The progress of ${songs(Object.keys(result.progress).length)} is restored. Tap Done, then play.`);
  };
  return (
    <section class="parent-section save-restore">
      <h2>Restore save code</h2>
      <p>Paste a save code. Its progress replaces the progress on this device.</p>
      <textarea
        class="parent-code"
        rows="5"
        value={text()}
        aria-label="Save code to restore"
        autocomplete="off"
        spellcheck="false"
        onInput={(event) => setText(event.currentTarget.value)}
      />
      <button
        type="button"
        class="save-restore-button"
        disabled={text().trim() === ''}
        onClick={() => {
          run().catch(() => setNote(REFUSED.shape));
        }}
      >
        Restore
      </button>
      <p class="parent-note" aria-live="polite">
        {note()}
      </p>
    </section>
  );
};
