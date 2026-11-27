import type { PlayDay } from '../../model';
import type { SessionStore } from '../../shell/session';

// The parts of the page that the session controller (./controller.ts) uses. src/main.tsx gives the real ones, and the
// tests give fakes.

/** The wall clock and the local calendar of the device. */
export type Clock = {
  /** The wall time in ms. */
  readonly now: () => number;
  /** The play day of `now` with the stop time `stopMinutes`, from the local calendar (src/shell/play-day.ts). */
  readonly day: (now: number, stopMinutes: number) => PlayDay;
};

/** The timers of the page. */
export type Timers = {
  readonly setTimeout: (run: () => void, ms: number) => number;
  readonly clearTimeout: (id: number | undefined) => void;
  readonly setInterval: (run: () => void, ms: number) => number;
  readonly clearInterval: (id: number | undefined) => void;
};

export type SessionPorts = {
  readonly clock: Clock;
  readonly timers: Timers;
  /** The page is visible when the controller starts. */
  readonly visible: boolean;
  /** The stored session state and the settings of the parent area, read at each event. */
  readonly store: Pick<SessionStore, 'read' | 'write' | 'settings'>;
};
