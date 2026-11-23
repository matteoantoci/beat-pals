import { Show } from 'solid-js';
import { loadLastProblem, type LoadProblemKind } from '../../shell/load-notes';
import type { JSX } from 'solid-js';

// The last song that did not load, for the parent (spec, "Screens", load scene): what went wrong, when, and what
// to do. The child sees only the oops moment. The song title is not kept.

const TEXTS: Readonly<Record<LoadProblemKind, string>> = {
  missing: 'a song file was missing. The app downloads it again at the next start with a network.',
  locked: 'a song file did not open with the key. Use "Change key" and set up the songs again.',
  facts: 'the song facts were damaged. Prepare the song again and deploy.',
  audio: 'the iPhone could not decode the song. Close other apps and try again.',
  stage: 'the iPhone could not start the graphics. Close the app and open it again.',
  other: 'the song did not start. Try again.',
};

const timeText = (at: number): string =>
  new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const LoadProblemNote = (): JSX.Element => (
  <Show when={loadLastProblem()}>
    {(problem) => (
      <p class="song-note song-load-problem">{`Last song problem (${timeText(problem().at)}): ${TEXTS[problem().kind]}`}</p>
    )}
  </Show>
);
