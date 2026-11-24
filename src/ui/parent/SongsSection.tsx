import { createMemo, createSignal, Match, onSettled, Show, Switch } from 'solid-js';
import { setupStep } from '../../model';
import { forgetSongs, isStandalone, loadFamilyKey, setupMark, watchDownload } from '../../shell/songs';
import { DownloadStep } from './DownloadStep';
import { InstallStep } from './InstallStep';
import { KeyStep } from './KeyStep';
import { SongsReady } from './SongsReady';
import type { FamilyKey, SetupStep } from '../../model';
import type { JSX } from '@solidjs/web';
import type { Accessor } from 'solid-js';

// The "Songs" section of the parent area (spec, "Guided song setup"): one step at a time (install, key, download,
// done), from the stored setup mark, the stored key, and the display mode. After the setup, the section shows the
// ready songs. "Change key" clears the songs and the key, and starts again at the key step.

/** Two reads of the stored key give 2 objects: the same key id is the same key, so the view stays. */
const sameKey = (one: FamilyKey | undefined, two: FamilyKey | undefined): boolean => one?.id === two?.id;

const ChangeKey = (props: { readonly onDone: () => void }): JSX.Element => {
  const [busy, setBusy] = createSignal(false);
  const change = (): void => {
    setBusy(true);
    forgetSongs()
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
        props.onDone();
      });
  };
  return (
    <button type="button" class="parent-link song-change-key" disabled={busy()} onClick={change}>
      Change key
    </button>
  );
};

type SetupFacts = {
  readonly key: Accessor<FamilyKey | undefined>;
  readonly step: Accessor<SetupStep>;
  readonly loaded: Accessor<boolean>;
  readonly refresh: () => void;
};

/** The facts of the setup step: the stored key and the stored mark, read again after a key, a download, or a reset. */
const setupFacts = (): SetupFacts => {
  const [key, setKey] = createSignal<FamilyKey | undefined>(undefined, { equals: sameKey });
  const [mark, setMark] = createSignal(setupMark());
  const [loaded, setLoaded] = createSignal(false);
  const loadedKey = (stored: FamilyKey | undefined): void => {
    setKey(stored);
    setLoaded(true);
  };
  const refresh = (): void => {
    setMark(setupMark());
    loadFamilyKey().then(loadedKey, () => loadedKey(undefined));
  };
  const step = createMemo(() => setupStep({ standalone: isStandalone(), hasKey: key() !== undefined, mark: mark() }));
  onSettled(() => {
    refresh();
    return watchDownload((event) => event.type === 'end' && setMark(setupMark()));
  });
  return { key, step, loaded, refresh };
};

export const SongsSection = (): JSX.Element => {
  const { key, step, loaded, refresh } = setupFacts();
  return (
    <section class="parent-section songs-section">
      <h2>Songs</h2>
      <Show when={loaded()}>
        <Switch>
          <Match when={step() === 'install'}>
            <InstallStep />
          </Match>
          <Match when={step() === 'key'}>
            <KeyStep onKey={refresh} />
          </Match>
          <Match when={step() !== 'done' && key()} keyed>
            {(songKey) => (
              <>
                <p class="song-key-ok">{`Key OK (key id ${songKey.id})`}</p>
                <DownloadStep songKey={songKey} stopped={step() === 'stopped'} />
                <ChangeKey onDone={refresh} />
              </>
            )}
          </Match>
          <Match when={key()} keyed>
            {(songKey) => (
              <>
                <SongsReady songKey={songKey} />
                <ChangeKey onDone={refresh} />
              </>
            )}
          </Match>
        </Switch>
      </Show>
    </section>
  );
};
