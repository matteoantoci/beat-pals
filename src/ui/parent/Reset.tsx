import { createSignal, Show } from 'solid-js';
import { clearSave } from '../../shell/save';
import type { JSX } from 'solid-js';

// The reset of the parent area: it deletes the progress after a confirmation. The Sound effects switch, the
// downloaded songs, and the family key are not progress, so they stay.

export const Reset = (): JSX.Element => {
  const [asking, setAsking] = createSignal(false);
  const [note, setNote] = createSignal('');
  const confirm = (): void => {
    setAsking(false);
    setNote(
      clearSave()
        ? 'The progress is deleted. Each song starts again at bronze with 0 stars.'
        : 'The progress could not be deleted.'
    );
  };
  return (
    <section class="parent-section reset-section">
      <h2>Reset</h2>
      <Show
        when={asking()}
        fallback={
          <button type="button" class="parent-danger reset-ask" onClick={() => setAsking(true)}>
            Reset progress
          </button>
        }
      >
        <p>
          Delete all progress? The stars and the record colors of each song go away. The songs, the family key, and the
          settings stay. You cannot undo this.
        </p>
        <button type="button" class="parent-danger reset-confirm" onClick={confirm}>
          Delete all progress
        </button>
        <button type="button" class="reset-cancel" onClick={() => setAsking(false)}>
          Cancel
        </button>
      </Show>
      <p class="parent-note" aria-live="polite">
        {note()}
      </p>
    </section>
  );
};
