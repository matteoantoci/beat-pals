import { createSignal, onCleanup, onMount } from 'solid-js';
import { loadFamilyKey, readSongStore, watchDownload } from '../../shell/songs';
import type { Accessor } from 'solid-js';

// The title screen shows its play button only when at least one song is ready, so a tap never opens an empty song
// list (spec, "Screens"). The answer comes from the store when the screen shows, and from each progress event of a
// download that makes the first song ready.

/** A failed read of the store leaves the answer at "no song". */
const ignore = (): void => undefined;

/** The number of ready songs in the store. With no key or no store, 0. */
const readyCount = async (): Promise<number> => {
  const key = await loadFamilyKey();
  const store = key === undefined ? undefined : await readSongStore(key);
  return store?.ok === true ? store.plan.ready.length : 0;
};

/** True when the song list has at least one card. */
export const songsReady = (): Accessor<boolean> => {
  const [ready, setReady] = createSignal(false);
  onMount(() => {
    onCleanup(
      watchDownload((event) => {
        if (event.type === 'progress' && event.plan.ready.length > 0) {
          setReady(true);
        }
      })
    );
    readyCount()
      .then((count) => count > 0 && setReady(true))
      .catch(ignore);
  });
  return ready;
};
