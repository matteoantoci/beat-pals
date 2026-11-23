// "Change key" in the parent area (spec, "Guided song setup"): it clears the song cache (the last manifest and its
// index included), deletes the stored key, and starts the setup again at the key step.

import { stopDownload } from './download';
import { deleteFamilyKey } from './key-store';
import { forgetSongFiles } from './last-store';
import { clearSetup } from './setup';

/** Stops a running download, and then deletes the songs, the key, and the setup mark. */
export const forgetSongs = async (): Promise<void> => {
  await stopDownload();
  await forgetSongFiles();
  await deleteFamilyKey();
  clearSetup();
};
