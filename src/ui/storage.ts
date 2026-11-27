import { createContext, useContext } from 'solid-js';
import type { DeviceStorage } from '../shell/storage';

// The device storage of this run (src/shell/storage) for the screens. main.tsx makes one storage and gives it with
// this context, and gives the same storage to the session controller. So the parent area writes the settings that
// the controller reads.

export const StorageContext = createContext<DeviceStorage>();

/** The device storage of this run. Call it in the setup of a component, not in a later callback. */
export const useStorage = (): DeviceStorage => useContext(StorageContext);
