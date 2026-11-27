import { checkForUpdate, openSafeWindow } from '../../shell/update';

// The safe point for an app update: the normal title before the first touch, and the night title after the goodbye
// scene (play-sessions spec, "Night title and wake-up"). The goodbye scene and the wake-up scene never open it.

/** A return of the page to the front: look for a new version. In the safe window, it then applies. */
const onVisible = (): void => {
  if (document.visibilityState === 'visible') {
    checkForUpdate();
  }
};

/** Keeps the safe window open until the first touch, and looks for a new version when the page shows again. Gives
 * the function that stops both. */
export const watchSafePoint = (): (() => void) => {
  const closeSafeWindow = openSafeWindow();
  document.addEventListener('pointerdown', closeSafeWindow, { capture: true, once: true, passive: true });
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    closeSafeWindow();
    document.removeEventListener('pointerdown', closeSafeWindow, { capture: true });
    document.removeEventListener('visibilitychange', onVisible);
  };
};
