// The device storage: the values that the game keeps in localStorage, each under its key (./keys.ts), with the rules
// of ./slot.ts. main.tsx makes one storage at the start and gives it to the screens and the session controller, so
// they read and write the same values. A test makes a new storage on the memory adapter.
// The songs and the family key are not here: they live in Cache Storage and IndexedDB (src/shell/songs/).

import { decodeRateCodec, loadProblemCodec } from '../load-notes';
import { saveCodec, saveStore } from '../save';
import { sessionSettingsCodec, sessionStateCodec, sessionStore } from '../session';
import { soundCodec } from '../settings';
import { setupCodec } from '../songs/setup';
import { STORAGE_KEYS } from './keys';
import { slot } from './slot';
import type { LoadProblem } from '../load-notes';
import type { SaveStore } from '../save';
import type { SessionStore } from '../session';
import type { SetupSlot } from '../songs/setup';
import type { Slot, StorageAdapter } from './slot';

export { localStorageAdapter, memoryAdapter } from './slot';

export type DeviceStorage = {
  /** The progress of the songs. */
  readonly save: SaveStore;
  /** The session state and the session settings. */
  readonly session: SessionStore;
  /** The Sound effects switch of the parent area. */
  readonly sound: Slot<boolean>;
  /** The step that the guided song setup reached. */
  readonly setup: SetupSlot;
  /** The decode rate of this device in ms for each MB of encoded audio. */
  readonly decodeRate: Slot<number>;
  /** The last load problem, for the parent area. */
  readonly loadProblem: Slot<LoadProblem | undefined>;
};

export const createDeviceStorage = (adapter: StorageAdapter): DeviceStorage => ({
  save: saveStore(slot(adapter, STORAGE_KEYS.save, saveCodec)),
  session: sessionStore(
    slot(adapter, STORAGE_KEYS.session, sessionStateCodec),
    slot(adapter, STORAGE_KEYS.sessionSettings, sessionSettingsCodec)
  ),
  sound: slot(adapter, STORAGE_KEYS.sound, soundCodec),
  setup: slot(adapter, STORAGE_KEYS.setup, setupCodec),
  decodeRate: slot(adapter, STORAGE_KEYS.decodeRate, decodeRateCodec),
  loadProblem: slot(adapter, STORAGE_KEYS.loadProblem, loadProblemCodec),
});
