// The Screen Wake Lock during a play (spec, "Sound and the audio clock"; iOS 18.4 and later), so Auto-Lock does not
// stop the song. The browser drops the lock when the page hides; the play pauses then, and its resume asks again.
// An older iOS has no Wake Lock API, and a refused request changes nothing: the song still plays.

const ignore = (): undefined => undefined;

/** Keeps the screen on. Gives the function that lets it sleep again. */
export const keepScreenOn = (): (() => void) => {
  let released = false;
  let sentinel: WakeLockSentinel | undefined;
  const request = 'wakeLock' in navigator ? navigator.wakeLock.request('screen') : Promise.reject(new Error('none'));
  request.then((lock) => {
    sentinel = lock;
    if (released) {
      lock.release().catch(ignore);
    }
  }, ignore);
  return () => {
    released = true;
    sentinel?.release().catch(ignore);
  };
};
