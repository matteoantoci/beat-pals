// The Screen Wake Lock (iOS 18.4 and later) during a play and during a song download (spec, "Sound and the audio
// clock" and "Delivery"), so Auto-Lock does not stop the song or the download. The browser drops the lock when the
// page hides, so a lock that is still kept asks again at each return to visible. A play pauses when the page hides
// and lets its lock go; a download runs on and gets its lock back.
// An older iOS has no Wake Lock API, and a refused request changes nothing: the song still plays.

import { watchLifecycle } from './lifecycle';

const ignore = (): undefined => undefined;

/** Keeps the screen on, also after each return to visible. Gives the function that lets it sleep again. */
export const keepScreenOn = (): (() => void) => {
  let released = false;
  let sentinel: WakeLockSentinel | undefined;
  const ask = (): void => {
    const request = 'wakeLock' in navigator ? navigator.wakeLock.request('screen') : Promise.reject(new Error('none'));
    request.then((lock) => {
      sentinel = lock;
      if (released) {
        lock.release().catch(ignore);
      }
    }, ignore);
  };
  ask();
  const unwatch = watchLifecycle({ hidden: ignore, visible: ask });
  return () => {
    released = true;
    unwatch();
    sentinel?.release().catch(ignore);
  };
};
