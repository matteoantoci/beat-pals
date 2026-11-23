import type { DownloadPlan } from '../../model';
import type { StoreProblem } from '../../shell/songs';
import type { JSX } from 'solid-js';

// The texts and the progress bar of the "Songs" section (spec, "Guided song setup"), for the download step and the
// view after the setup.

export const songs = (count: number): string => `${String(count)} ${count === 1 ? 'song' : 'songs'}`;

/** Megabytes as the Parent reads them: one decimal below 10 MB. */
export const megabytes = (bytes: number): string => {
  const mb = bytes / 1_000_000;
  return mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
};

/** The text of a store problem. */
export const problemText = (store: StoreProblem): string => {
  if (store.problem === 'network') {
    return 'No network. Connect to Wi-Fi and try again.';
  }
  if (store.problem === 'wrong-key') {
    return 'The songs on the site need another key. Use "Change key" to enter it.';
  }
  return `The songs cannot be read: ${store.reason}.`;
};

/** The progress bar and "12 of 31 songs, 48 of 140 MB". */
export const Progress = (props: { readonly plan: DownloadPlan }): JSX.Element => (
  <>
    <progress class="song-progress" value={props.plan.done.bytes} max={props.plan.total.bytes} />
    <p class="song-progress-text">
      {`${String(props.plan.done.songs)} of ${songs(props.plan.total.songs)}, ` +
        `${megabytes(props.plan.done.bytes)} of ${megabytes(props.plan.total.bytes)} MB`}
    </p>
  </>
);
