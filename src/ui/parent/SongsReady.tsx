import { createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { downloading, lastProgress, readSongStore, startDownload, storageKept, watchDownload } from '../../shell/songs';
import { megabytes, problemText, Progress, songs } from './song-texts';
import type { DownloadPlan, FamilyKey } from '../../model';
import type { StoreProblem } from '../../shell/songs';
import type { JSX } from 'solid-js';

// The "Songs" section after the setup (spec, "Guided song setup", step 4 and after): the song count and the state
// ("31 songs ready on this iPhone", "Downloading 3 new songs, 25 MB", or "Offline: 31 songs ready on this iPhone"),
// and the result of the storage request. The new songs download by themselves at each start and each return to the
// app; a download that stopped can also continue from here.

type ReadyState =
  | { kind: 'reading' }
  | { kind: 'problem'; text: string }
  | { kind: 'running'; plan: DownloadPlan }
  | { kind: 'ready'; plan: DownloadPlan; site: StoreProblem | undefined };

const Running = (props: { readonly plan: DownloadPlan }): JSX.Element => {
  const { total, done } = props.plan;
  const count = total.songs - done.songs;
  const size = megabytes(total.bytes - done.bytes);
  return (
    <>
      <p class="song-state">{`Downloading ${String(count)} new ${count === 1 ? 'song' : 'songs'}, ${size} MB`}</p>
      <Progress plan={props.plan} />
    </>
  );
};

type ReadyProps = {
  readonly plan: DownloadPlan;
  readonly site: StoreProblem | undefined;
  readonly onStart: () => void;
};

/** The ready songs. Offline, the last complete store gives them. */
const Ready = (props: ReadyProps): JSX.Element => {
  const ready = `${songs(props.plan.done.songs)} ready on this iPhone`;
  const { site } = props;
  if (site?.problem === 'network') {
    return <p class="song-ready song-offline">{`Offline: ${ready}`}</p>;
  }
  return (
    <>
      <p class="song-ready">{ready}</p>
      <Show when={site} fallback={<Missing plan={props.plan} onStart={props.onStart} />}>
        {(problem) => <p class="song-note">{problemText(problem())}</p>}
      </Show>
    </>
  );
};

/** The files of the site that are not on the device yet, after a download that stopped. */
const Missing = (props: { readonly plan: DownloadPlan; readonly onStart: () => void }): JSX.Element => (
  <Show when={props.plan.fetch.length > 0}>
    <button type="button" class="song-download song-continue" onClick={() => props.onStart()}>
      Download stopped. Tap to continue.
    </button>
  </Show>
);

const StateView = (props: { readonly state: ReadyState; readonly onStart: () => void }): JSX.Element => {
  const { state } = props;
  if (state.kind === 'reading') {
    return <p>Reading the song list…</p>;
  }
  if (state.kind === 'problem') {
    return <p class="song-note">{state.text}</p>;
  }
  if (state.kind === 'running') {
    return <Running plan={state.plan} />;
  }
  return <Ready plan={state.plan} site={state.site} onStart={props.onStart} />;
};

const errorText = (error: unknown): string => `Error: ${error instanceof Error ? error.message : String(error)}.`;

export const SongsReady = (props: { readonly songKey: FamilyKey }): JSX.Element => {
  const progress = lastProgress();
  const [state, setState] = createSignal<ReadyState>(
    downloading() && progress !== undefined ? { kind: 'running', plan: progress } : { kind: 'reading' }
  );
  const [kept] = createResource(storageKept);
  const read = (): void => {
    readSongStore(props.songKey).then(
      (store) =>
        setState(
          store.ok
            ? { kind: 'ready', plan: store.plan, site: store.site }
            : { kind: 'problem', text: problemText(store) }
        ),
      (error: unknown) => setState({ kind: 'problem', text: errorText(error) })
    );
  };
  const start = (): void => {
    startDownload(props.songKey).catch((error: unknown) => setState({ kind: 'problem', text: errorText(error) }));
  };
  onMount(() => {
    onCleanup(
      watchDownload((event) => (event.type === 'progress' ? setState({ kind: 'running', plan: event.plan }) : read()))
    );
    if (!downloading()) {
      read();
    }
  });
  return (
    <>
      <Show when={state()} keyed>
        {(current) => <StateView state={current} onStart={start} />}
      </Show>
      <Show when={kept.state === 'ready'}>
        <p class="song-storage">
          {kept() === true ? 'Storage kept' : 'Storage can be cleared by iOS when the phone is full'}
        </p>
      </Show>
    </>
  );
};
