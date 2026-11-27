// "Change key" in the parent area (spec, "Guided song setup"): it clears the song cache (the last manifest and its
// index included), deletes the stored key, and starts the setup again at the key step.

import { stopDownload } from './download';
import { deleteFamilyKey } from './key-store';
import { forgetSongFiles } from './last-store';
import type { SetupSlot } from './setup';

/** Stops a running download, and then deletes the songs, the key, and the setup mark in `setup`. */
export const forgetSongs = async (setup: SetupSlot): Promise<void> => {
  await stopDownload();
  await forgetSongFiles();
  await deleteFamilyKey();
  setup.clear();
};
