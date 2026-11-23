import { createSignal } from 'solid-js';
import { checkKeyCode } from '../../shell/songs';
import type { FamilyKey } from '../../model';
import type { KeyCheck } from '../../shell/songs';
import type { JSX } from 'solid-js';

// Step 2 of the song setup (spec, "Guided song setup"): the key code field and the check. The decode rules run
// before any request. A wrong key keeps the field.

const KEY_TEXTS: Readonly<Record<string, string>> = {
  'not-a-code': 'This is not a key code',
  network: 'No network. Connect to Wi-Fi and check again.',
  'wrong-key': 'This key does not open the songs',
};

export const KeyStep = (props: { readonly onKey: (key: FamilyKey) => void }): JSX.Element => {
  const [code, setCode] = createSignal('');
  const [note, setNote] = createSignal('');
  const [checking, setChecking] = createSignal(false);
  const checked = (result: KeyCheck): void => {
    setChecking(false);
    if (result.ok) {
      setCode('');
      props.onKey(result.key);
      return;
    }
    setNote(KEY_TEXTS[result.problem] ?? `The songs cannot be read: ${result.reason}.`);
  };
  const check = (): void => {
    setNote('');
    setChecking(true);
    checkKeyCode(code()).then(checked, (error: unknown) => {
      setChecking(false);
      setNote(`The check failed: ${error instanceof Error ? error.message : String(error)}.`);
    });
  };
  return (
    <>
      <label for="song-key">Key code</label>
      <input
        id="song-key"
        class="parent-code"
        type="text"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="characters"
        spellcheck={false}
        value={code()}
        onInput={(event) => setCode(event.currentTarget.value)}
      />
      <button type="button" class="song-key-check" disabled={checking()} onClick={check}>
        Check
      </button>
      <p class="parent-note song-note" role="status">
        {note()}
      </p>
    </>
  );
};
