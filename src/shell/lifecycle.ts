// The lifecycle of the page. On iOS, `visibilitychange` to `hidden` is the last event that always runs:
// `pagehide` and `beforeunload` can be missing when the web content process dies.
// The sound module has its own listener for the audio context: do not touch the audio here.

export type Lifecycle = {
  /** The page is not visible: save the state. */
  readonly hidden: () => void;
  /** The page is visible again: ask the browser for a new version. */
  readonly visible: () => void;
};

/** Adds a listener for the visibility of the page. Returns the function that removes it. */
export const watchLifecycle = ({ hidden, visible }: Lifecycle): (() => void) => {
  const listener = (): void => {
    if (document.visibilityState === 'hidden') {
      hidden();
      return;
    }
    visible();
  };
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
};
