// The screen registry of the session demo route (play-sessions spec, "Demo route"): one entry for each screen.
// Each file in ./screens/ exports `screens`: a record of screen names and their components. The registry collects
// every file of that folder, so a ticket adds its screens in a new file, and no other file changes (the parser
// gets the names from here). A name that 2 files give stops the route with an error.
import type { JSX } from '@solidjs/web';

export type SessionScreenProps = {
  /** The scene time in seconds where the screen freezes. */
  readonly t: number;
  /** Reduced motion: the screen shows the reduced-motion version of its scene. */
  readonly reduce: boolean;
  /**
   * Call when the frame shows, after the screen has made its animations. In the next frame, the demo pauses each
   * animation of the screen (Web Animations and CSS animations) at `t`, and marks its root with `data-demo-ready`. A
   * screen that draws its frame for `t` itself (a canvas) has no animation to pause.
   */
  readonly ready: () => void;
};

type SessionScreen = (props: SessionScreenProps) => JSX.Element;

export type SessionScreens = Readonly<Record<string, SessionScreen>>;

const files = import.meta.glob<SessionScreens>('./screens/*.tsx', { eager: true, import: 'screens' });

const entries = Object.entries(files).flatMap(([file, screens]) =>
  Object.entries(screens).map(([name, screen]) => ({ file, name, screen }))
);
const twice = entries.filter((entry, at) => entries.findIndex(({ name }) => name === entry.name) !== at);
if (twice.length > 0) {
  throw new Error(
    `2 files give the session demo screens ${twice.map(({ name, file }) => `${name} (${file})`).join(', ')}.`
  );
}

/** Each screen of the registry by its name. */
export const SESSION_SCREENS: SessionScreens = Object.fromEntries(entries.map(({ name, screen }) => [name, screen]));
