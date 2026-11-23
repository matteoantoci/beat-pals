// The reduced motion setting of the system (C16). The play and the end scene read it at their start and follow each
// `change` of the media query: the play draws its next frame with the new value, and the end scene skips to its
// final state.

const query = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = query.matches;
query.addEventListener('change', (event) => {
  reduced = event.matches;
});

/** True while the system asks for reduced motion. */
export const reducedMotion = (): boolean => reduced;

/** Calls `listener` at each change of the setting. Gives the function that stops the watch. */
export const watchReducedMotion = (listener: (reduced: boolean) => void): (() => void) => {
  const onChange = (event: MediaQueryListEvent): void => listener(event.matches);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
