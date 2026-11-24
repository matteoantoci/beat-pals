import { createSignal, onSettled, Show } from 'solid-js';
import { downloading, lastProgress, readSongStore, startDownload, watchDownload } from '../../shell/songs';
import { megabytes, problemText, Progress, songs } from './song-texts';
import type { DownloadPlan, FamilyKey } from '../../model';
import type { SongStore } from '../../shell/songs';
import type { JSX } from '@solidjs/web';

// Step 3 of the song setup (spec, "Guided song setup"): the download. It reads the song index first, so it can name
// the song count and the size. A download that stopped (network lost, app closed) shows "Download stopped. Tap to
// continue." and continues from the next missing file. The end of a complete download ends the setup, so the
// section then shows the view after the setup.

type DownloadState =
  | { kind: 'reading' }
  | { kind: 'problem'; text: string }
  | { kind: 'start' | 'stopped' | 'running'; plan: DownloadPlan };

/** The state after a store read or a download. `stopped`: a download of the setup started before. */
const stateOf = (store: SongStore, stopped: boolean): DownloadState => {
  if (!store.ok) {
    // A download that stops on the network shows its progress and continues from the next missing file.
    const plan = lastProgress();
    return store.problem === 'network' && plan !== undefined
      ? { kind: 'stopped', plan }
      : { kind: 'problem', text: problemText(store) };
  }
  return { kind: stopped || store.plan.done.bytes > 0 ? 'stopped' : 'start', plan: store.plan };
};

/** The state at the end of a download. A complete download ends the setup, and the section shows the next view. */
const afterDownload = (result: SongStore): DownloadState =>
  result.ok ? { kind: 'running', plan: result.plan } : stateOf(result, true);

type ViewProps = { readonly state: DownloadState; readonly onRead: () => void; readonly onStart: () => void };

/** The step text and its button for each state. */
const DownloadView = (props: ViewProps): JSX.Element => {
  const { state } = props;
  if (state.kind === 'reading') {
    return <p>Reading the song list…</p>;
  }
  if (state.kind === 'problem') {
    return (
      <>
        <p class="song-note">{state.text}</p>
        <button type="button" onClick={() => props.onRead()}>
          Try again
        </button>
      </>
    );
  }
  if (state.kind === 'start') {
    return (
      <>
        <p class="song-size">{`Download ${songs(state.plan.total.songs)} (${megabytes(state.plan.total.bytes)} MB). Keep the app open on Wi-Fi.`}</p>
        <button type="button" class="song-download" onClick={() => props.onStart()}>
          Download
        </button>
      </>
    );
  }
  return (
    <>
      <Progress plan={state.plan} />
      <Show when={state.kind === 'stopped'}>
        <button type="button" class="song-download song-continue" onClick={() => props.onStart()}>
          Download stopped. Tap to continue.
        </button>
      </Show>
    </>
  );
};

type DownloadStepProps = { readonly songKey: FamilyKey; readonly stopped: boolean };

export const DownloadStep = (props: DownloadStepProps): JSX.Element => {
  const progress = lastProgress();
  const [state, setState] = createSignal<DownloadState>(
    downloading() && progress !== undefined ? { kind: 'running', plan: progress } : { kind: 'reading' }
  );
  const failed = (error: unknown): void => {
    setState({ kind: 'problem', text: `Error: ${error instanceof Error ? error.message : String(error)}.` });
  };
  const read = (): void => {
    setState({ kind: 'reading' });
    readSongStore(props.songKey).then((store) => setState(stateOf(store, props.stopped)), failed);
  };
  const start = (): void => {
    // The events of the download set the state.
    startDownload(props.songKey).catch(failed);
  };
  onSettled(() => {
    const unwatch = watchDownload((event) =>
      setState(event.type === 'progress' ? { kind: 'running', plan: event.plan } : afterDownload(event.result))
    );
    if (!downloading()) {
      read();
    }
    return unwatch;
  });
  return (
    <Show when={state()} keyed>
      {(current) => <DownloadView state={current} onRead={read} onStart={start} />}
    </Show>
  );
};
