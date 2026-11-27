// The automatic download after the setup (spec, "Delivery", wake lock and return). At the start of the app and at
// each return to visible, the game reads the manifest and downloads the new or changed files in the background. It
// also continues an interrupted download. Before the setup is done, only the parent starts a download.

import { watchLifecycle } from '../lifecycle';
import { downloading, startDownload } from './download';
import { loadFamilyKey } from './key-store';
import type { SetupSlot } from './setup';

/** A failed start, for example with no network, waits for the next start or return. */
const refresh = (setup: SetupSlot): void => {
  if (setup.get() !== 'done' || downloading()) {
    return;
  }
  loadFamilyKey()
    .then(async (key) => (key === undefined ? undefined : startDownload(key, setup)))
    .catch(() => undefined);
};

/** Downloads the new songs now and at each return to visible. Returns the function that stops the watch. */
export const keepSongsFresh = (setup: SetupSlot): (() => void) => {
  refresh(setup);
  return watchLifecycle({ hidden: () => undefined, visible: () => refresh(setup) });
};
