// The service worker of the app. vite-plugin-pwa runs in prompt mode: a new version installs and waits.
// The app accepts the update, not the Child: the prompt is the title screen before the first touch, or the night
// title, with no text on the screen (as in Pile Pals). A waiting update must never reload the page in the middle of a
// song or of a session scene.

import { registerSW } from 'virtual:pwa-register';

/** Calls the service worker to skip the wait and reloads the page. */
type Update = (reloadPage?: boolean) => Promise<void>;

let waiting = false;
/** True while the screen is at a safe point (the title screen before the first touch, or the night title). */
let safe = false;
let registration: ServiceWorkerRegistration | undefined;
let update: Update | undefined;

/** A service worker call that fails is not an error of the game. */
const ignored = (): void => undefined;

/**
 * Applies a waiting update: the new service worker takes control and the page reloads.
 * Only a safe window calls it.
 */
const applyUpdateIfWaiting = (): void => {
  if (waiting && update) {
    update(true).catch(ignored);
  }
};

/** Registers the service worker and starts the check. Call it one time, before the first render. */
export const watchUpdates = (): void => {
  update = registerSW({
    immediate: true,
    // No prompt on the screen: the update waits for a safe point. During a safe window, it applies at once.
    onNeedRefresh: () => {
      waiting = true;
      if (safe) {
        applyUpdateIfWaiting();
      }
    },
    onRegisteredSW: (_url, registered) => {
      registration = registered;
    },
  });
};

/** Asks the browser for a new version. A return from the background is not a navigation. */
export const checkForUpdate = (): void => {
  registration?.update().catch(ignored);
};

/**
 * Starts a safe window: a waiting update applies now, and an update that becomes ready during the window
 * applies when it is ready. The title screen and the night title open the window when they show, and close it at
 * the first touch (src/ui/title/safe-point.ts).
 * Returns the function that closes the window.
 */
export const openSafeWindow = (): (() => void) => {
  safe = true;
  applyUpdateIfWaiting();
  return () => {
    safe = false;
  };
};
