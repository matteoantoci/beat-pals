import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import {
  downloading,
  lastProgress,
  loadFamilyKey,
  readSongStore,
  startDownload,
  watchDownload,
} from '../../shell/songs';
import { KeyStep } from './KeyStep';
import type { DownloadPlan, FamilyKey } from '../../model';
import type { SongStore } from '../../shell/songs';
import type { JSX } from 'solid-js';

// The "Songs" section of the parent area (spec, "Guided song setup"): the key step and the download step.
// The install step, the setup state, and the view after the setup come later.

const songs = (count: number): string => `${String(count)} ${count === 1 ? 'song' : 'songs'}`;

/** Megabytes as the Parent reads them: one decimal below 10 MB. */
const megabytes = (bytes: number): string => {
  const mb = bytes / 1_000_000;
  return mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
};

type DownloadState =
  | { kind: 'reading' }
  | { kind: 'problem'; text: string }
  | { kind: 'start' | 'stopped' | 'running' | 'done'; plan: DownloadPlan };

const problemText = (store: Extract<SongStore, { ok: false }>): string =>
  store.problem === 'network'
    ? 'No network. Connect to Wi-Fi and try again.'
    : `The songs cannot be read: ${store.reason}.`;

/** The state after a store read or a download. */
const stateOf = (store: SongStore): DownloadState => {
  if (!store.ok) {
    // A download that stops on the network shows its progress and continues from the next missing file.
    const plan = lastProgress();
    return store.problem === 'network' && plan !== undefined
      ? { kind: 'stopped', plan }
      : { kind: 'problem', text: problemText(store) };
  }
  if (store.plan.fetch.length === 0) {
    return { kind: 'done', plan: store.plan };
  }
  // Files in the cache and files missing: a download stopped before.
  return { kind: store.plan.done.bytes > 0 ? 'stopped' : 'start', plan: store.plan };
};

const Progress = (props: { readonly plan: DownloadPlan }): JSX.Element => (
  <>
    <progress class="song-progress" value={props.plan.done.bytes} max={props.plan.total.bytes} />
    <p class="song-progress-text">
      {`${String(props.plan.done.songs)} of ${songs(props.plan.total.songs)}, ` +
        `${megabytes(props.plan.done.bytes)} of ${megabytes(props.plan.total.bytes)} MB`}
    </p>
  </>
);

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
        <p>{`Download ${songs(state.plan.total.songs)} (${megabytes(state.plan.total.bytes)} MB). Keep the app open on Wi-Fi.`}</p>
        <button type="button" class="song-download" onClick={() => props.onStart()}>
          Download
        </button>
      </>
    );
  }
  if (state.kind === 'done') {
    return <p class="song-ready">{`${songs(state.plan.done.songs)} ready on this iPhone`}</p>;
  }
  return (
    <>
      <Progress plan={state.plan} />
      <Show when={state.kind === 'stopped'}>
        <button type="button" class="song-download" onClick={() => props.onStart()}>
          Download stopped. Tap to continue.
        </button>
      </Show>
    </>
  );
};

/** Step 3: the download. It reads the song index first, so it can name the song count and the size. */
const DownloadStep = (props: { readonly songKey: FamilyKey }): JSX.Element => {
  const progress = lastProgress();
  const [state, setState] = createSignal<DownloadState>(
    downloading() && progress !== undefined ? { kind: 'running', plan: progress } : { kind: 'reading' }
  );
  const failed = (error: unknown): void => {
    setState({ kind: 'problem', text: `Error: ${error instanceof Error ? error.message : String(error)}.` });
  };
  const read = (): void => {
    setState({ kind: 'reading' });
    readSongStore(props.songKey).then((store) => setState(stateOf(store)), failed);
  };
  const start = (): void => {
    // The end event of the download sets the state.
    startDownload(props.songKey).catch(failed);
  };
  onMount(() => {
    onCleanup(
      watchDownload((event) =>
        setState(event.type === 'progress' ? { kind: 'running', plan: event.plan } : stateOf(event.result))
      )
    );
    if (!downloading()) {
      read();
    }
  });
  return (
    <Show when={state()} keyed>
      {(current) => <DownloadView state={current} onRead={read} onStart={start} />}
    </Show>
  );
};

export const SongsSection = (): JSX.Element => {
  const [key, setKey] = createSignal<FamilyKey | undefined>();
  const [loaded, setLoaded] = createSignal(false);
  onMount(() => {
    loadFamilyKey().then(
      (stored) => {
        setKey(stored);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
  });
  return (
    <section class="parent-section songs-section">
      <h2>Songs</h2>
      <Show when={loaded()}>
        <Show when={key()} fallback={<KeyStep onKey={setKey} />} keyed>
          {(songKey) => (
            <>
              <p class="song-key-ok">{`Key OK (key id ${songKey.id})`}</p>
              <DownloadStep songKey={songKey} />
            </>
          )}
        </Show>
      </Show>
    </section>
  );
};
