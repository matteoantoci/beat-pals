import { createSignal } from 'solid-js';
import { restOver, sessionAfter } from '../../model';
import { loadSessionSettings, readSession, writeSession } from '../../shell/session';
import type { SessionAnswer, SessionEvent, SessionState } from '../../model';
import type { Accessor } from 'solid-js';

// The session controller: the seam between the screens and the session model (play-sessions spec, "Session rules").
// It holds the session state of this run, gives each event the wall time, and writes the state at each change and at
// each hide. The time counts only while a counted screen shows (App calls `count`) and the page is visible, and a tick
// goes to the model every TICK_MS while it counts. A screen reads `state` and `restOver`, sends an event with `send`,
// and reads the facts of the model (the stage at the end of a song, the status line) at `now()`.

/** While the time counts, the model gets a tick at least this often. */
const TICK_MS = 15_000;

/** The events that a screen sends. The controller adds the wall time, and the settings to a list-open. */
type ScreenEvent = 'list-open' | 'song-start' | 'load-failed' | 'goodbye' | 'open-now' | 'wake-tap';

export type SessionController = {
  /** The session state of this run. */
  readonly state: Accessor<SessionState>;
  /** The pals sleep and the rest time is over. It turns true at the end of the rest time, also while a screen shows. */
  readonly restOver: Accessor<boolean>;
  /** The wall time, for the facts of the model. */
  readonly now: () => number;
  /** Sends an event of a screen. Gives the answer of the model (the state, the step of the sun, the last song). */
  readonly send: (type: ScreenEvent) => SessionAnswer;
  /** A counted screen shows (true), or a screen that does not count (false). */
  readonly count: (on: boolean) => void;
  /** The page is hidden. */
  readonly hide: () => void;
  /** The page is visible again. */
  readonly show: () => void;
};

type RestWatch = {
  readonly over: Accessor<boolean>;
  /** Sets `over` for the state, and while the rest time runs, a timer for its end. */
  readonly watch: (state: SessionState) => void;
};

/** The end of the rest time: it turns true at the end, also while a screen shows. */
const restWatch = (now: () => number): RestWatch => {
  const [over, setOver] = createSignal(false);
  let timer: number | undefined;
  const watch = (state: SessionState): void => {
    clearTimeout(timer);
    const ended = restOver(state, now());
    setOver(ended);
    if (state.kind === 'asleep' && !ended) {
      timer = window.setTimeout(() => watch(state), state.until - now());
    }
  };
  return { over, watch };
};

type Store = {
  readonly state: Accessor<SessionState>;
  readonly restOver: Accessor<boolean>;
  /** The state now. A signal gives a new value only at the next flush, so the store keeps it here too. */
  readonly current: () => SessionState;
  /** Gives the event to the model, and keeps and writes the state when it changed. */
  readonly apply: (event: SessionEvent) => SessionAnswer;
  /** Sets `restOver` again, for example after a show. */
  readonly watchRest: () => void;
};

/** The session state of this run, read from storage. */
const sessionStore = (now: () => number): Store => {
  let current = readSession(now());
  const [state, setState] = createSignal<SessionState>(current);
  const rest = restWatch(now);
  rest.watch(current);
  return {
    state,
    restOver: rest.over,
    current: () => current,
    apply: (event) => {
      const answer = sessionAfter(current, event);
      if (answer.state !== current) {
        current = answer.state;
        setState(current);
        writeSession(current);
        rest.watch(current);
      }
      return answer;
    },
    watchRest: () => rest.watch(current),
  };
};

/** Makes the controller of this run from the stored state. `now` gives the wall time in ms. */
export const createSession = (now: () => number = Date.now): SessionController => {
  const { state, restOver: rest, current, apply, watchRest } = sessionStore(now);
  let tickTimer: number | undefined;
  let counting = false;
  let visible = document.visibilityState === 'visible';
  const countNow = (on: boolean): void => {
    clearInterval(tickTimer);
    apply({ type: on ? 'count-start' : 'count-stop', now: now() });
    if (on) {
      tickTimer = window.setInterval(() => apply({ type: 'tick', now: now() }), TICK_MS);
    }
  };
  return {
    state,
    restOver: rest,
    now,
    send: (type) =>
      apply(type === 'list-open' ? { type, now: now(), settings: loadSessionSettings() } : { type, now: now() }),
    count: (on) => {
      counting = on;
      if (visible) {
        countNow(on);
      }
    },
    hide: () => {
      visible = false;
      clearInterval(tickTimer);
      apply({ type: 'hide', now: now() });
      // iOS can end a hidden app with no other event, so the state is written also when the hide changed nothing.
      writeSession(current());
    },
    show: () => {
      visible = true;
      apply({ type: 'show', now: now() });
      if (counting) {
        countNow(true);
      }
      watchRest();
    },
  };
};
