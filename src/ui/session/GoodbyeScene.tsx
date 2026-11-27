import { onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';

// The goodbye scene (play-sessions spec, "Screens and motion"): the scene after the last song, from the wave to the
// sleep. It lasts GOODBYE_MS and ignores each tap, and then the night title shows. The caller sends the goodbye event
// before the scene shows, so the state is asleep for the whole scene, and a reload in it gives the night title. The
// scene never opens the safe window of an app update. This is the plain look with no art; the full scene comes
// later (ticket 07).

/** The length of the goodbye scene. */
const GOODBYE_MS = 7600;

export const GoodbyeScene = (props: { readonly onDone: () => void }): JSX.Element => {
  const timer = setTimeout(() => props.onDone(), GOODBYE_MS);
  onCleanup(() => clearTimeout(timer));
  return <main class="goodbye" aria-hidden="true" />;
};
