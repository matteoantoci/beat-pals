// The device side of the guided song setup (spec, "Guided song setup" and "Delivery", storage): the stored mark of
// the setup (`beat-pals:setup`), the display mode of the app, and the persistent storage of the songs.

import { readSetupMark } from '../../model';
import type { SetupMark } from '../../model';

const SETUP_KEY = 'beat-pals:setup';

declare global {
  interface Navigator {
    /** Safari on iOS: true in a Home Screen app. */
    readonly standalone?: boolean;
  }
}

/** The stored mark of the setup, or undefined when the setup did not start or the storage cannot be read. */
export const setupMark = (): SetupMark | undefined => {
  try {
    return readSetupMark(localStorage.getItem(SETUP_KEY));
  } catch {
    return undefined;
  }
};

/** Stores the mark of the setup. A storage that refuses it changes nothing: the step shows from the key again. */
export const markSetup = (mark: SetupMark): void => {
  try {
    localStorage.setItem(SETUP_KEY, mark);
  } catch {
    // The storage is full or blocked.
  }
};

/** Removes the mark, so the setup starts again. */
export const clearSetup = (): void => {
  try {
    localStorage.removeItem(SETUP_KEY);
  } catch {
    // The storage is blocked.
  }
};

/** True when the app runs from the Home Screen, false in a Safari tab. */
export const isStandalone = (): boolean =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** Asks the browser to keep the song storage when the device is full. A missing API changes nothing. */
export const keepStorage = async (): Promise<void> => {
  if (!('storage' in navigator) || (await navigator.storage.persisted())) {
    return;
  }
  await navigator.storage.persist();
};

/** True when the browser keeps the song storage when the device is full. */
export const storageKept = async (): Promise<boolean> =>
  'storage' in navigator ? navigator.storage.persisted() : false;
