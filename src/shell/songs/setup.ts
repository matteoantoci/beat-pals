// The device side of the guided song setup (spec, "Guided song setup" and "Delivery", storage): the stored mark of
// the setup in the device storage, the display mode of the app, and the persistent storage of the songs.

import { readSetupMark } from '../../model';
import type { SetupMark } from '../../model';
import type { Codec, Slot } from '../storage/slot';

declare global {
  interface Navigator {
    /** Safari on iOS: true in a Home Screen app. */
    readonly standalone?: boolean;
  }
}

/** The stored mark of the setup in the device storage. */
export type SetupSlot = Slot<SetupMark | undefined>;

/** The mark of the setup, or undefined when the setup did not start. A failed write keeps the mark for this run. */
export const setupCodec: Codec<SetupMark | undefined> = {
  absent: undefined,
  decode: readSetupMark,
  encode: (mark) => mark ?? '',
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
