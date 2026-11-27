import { createSignal } from 'solid-js';
import { MINUTE_MS, restTimeOver, sessionAfter } from '../../model';
import { playDayOf } from '../../shell/play-day';
import { loadSessionSettings, readSession, writeSession } from '../../shell/session';
import type { PlayDay, SessionAnswer, SessionEvent, SessionState } from '../../model';
import type { Accessor } from 'solid-js';

// The session controller: the seam between the screens and the session model (play-sessions spec, "Session rules",
// changed by the session-schedule spec). It holds the session state of this run, gives each event the wall time and
// the play day, and writes the state at each change and at each hide. The time counts only while a counted screen
// shows (App calls `count`) and the page is visible, and a tick goes to the model every TICK_MS while it counts. While
// the normal title shows (the title screen calls `title`), the model gets a title-show at once, and again from the
// timer at the last start time of the evening. A screen reads `state` and `restTimeOver`, sends an event with `send`,
// and reads the facts of the model (the stage at the end of a song, the status line) at `now()` in `day()`.

/** While the time counts, the model gets a tick at least this often. */
const TICK_MS = 15_000;

/** The events that a screen sends. The controller adds the wall time, the play day, and the settings. */
type ScreenEvent = 'list-open' | 'song-start' | 'load-failed' | 'goodbye' | 'open-now' | 'wake-tap';

export type SessionController = {
  /** The session state of this run. It is a signal: a read right after `send` gives the old state until the next
   * flush (the smoke run shows this), so a screen that must know the new state uses the answer of `send`. */
  readonly state: Accessor<SessionState>;
  /** The pals sleep and the rest time is over. It turns true at the end of the rest time, also while a screen shows. */
  readonly restTimeOver: Accessor<boolean>;
  /** True from a title-show that put the pals to sleep until the next move to a screen: the title fades to night. */
  readonly toNight: Accessor<boolean>;
  /** The wall time, for the facts of the model. */
  readonly now: () => number;
  /** The play day of `now()`, for the facts of the model. */
  readonly day: () => PlayDay;
  /** Sends an event of a screen. Gives the answer of the model (the state, the step of the sun, the last song). */
  readonly send: (type: ScreenEvent) => SessionAnswer;
  /** A counted screen shows (true), or a screen that does not count (false). */
  readonly count: (on: boolean) => void;
  /** The normal title shows (true), or it does not show (false). */
  readonly title: (shown: boolean) => void;
  /** The page is hidden. */
  readonly hide: () => void;
  /** The page is visible again. */
  readonly show: () => void;
};

/**
 * The play day of `now`. Its stop time comes from the settings of the open session, because a change of a setting
 * applies from the next session. With no open session, it comes from the current settings.
 */
const dayOf = (state: SessionState, now: number): PlayDay =>
  playDayOf(now, state.kind === 'open' ? state.settings.stopMinutes : loadSessionSettings().stopMinutes);

type Watch = {
  readonly over: Accessor<boolean>;
  /** Sets `over` for the state. While the rest time runs, it sets a timer for its end. While the pals are awake, it
   * sets a timer for the end of the last start time, which calls `onLastStart`. */
  readonly watch: (state: SessionState) => void;
};

/** The end of the rest time, and the end of the last start time of the evening, also while a screen shows. */
const sessionWatch = (now: () => number, onLastStart: () => void): Watch => {
  const [over, setOver] = createSignal(false);
  let timer: number | undefined;
  const watch = (state: SessionState): void => {
    clearTimeout(timer);
    const ended = restTimeOver(state, now());
    setOver(ended);
    if (state.kind === 'asleep' && !ended) {
      timer = window.setTimeout(() => watch(state), state.until - now());
    }
    if (state.kind === 'awake' && !state.byParent) {
      // The model allows a start up to the last start time and refuses one after it.
      const lastStart = dayOf(state, now()).stop - loadSessionSettings().minutes * MINUTE_MS;
      timer = window.setTimeout(onLastStart, Math.max(0, lastStart + 1 - now()));
    }
  };
  return { over, watch };
};

type Store = {
  readonly state: Accessor<SessionState>;
  readonly restTimeOver: Accessor<boolean>;
  /** The state now. A read of the signal gives the new value only after the next flush, so the store keeps it here. */
  readonly current: () => SessionState;
  /** Gives the event to the model, and keeps and writes the state when it changed. */
  readonly apply: (event: SessionEvent) => SessionAnswer;
  /** Sets `restTimeOver` and the timers again, for example after a show. */
  readonly watchAgain: () => void;
};

/** The session state of this run, read from storage. `onLastStart`: the end of the last start time. */
const sessionStore = (now: () => number, onLastStart: () => void): Store => {
  const start = now();
  let current = readSession(start, playDayOf(start, loadSessionSettings().stopMinutes));
  const [state, setState] = createSignal<SessionState>(current);
  const watch = sessionWatch(now, onLastStart);
  watch.watch(current);
  return {
    state,
    restTimeOver: watch.over,
    current: () => current,
    apply: (event) => {
      const answer = sessionAfter(current, event);
      if (answer.state !== current) {
        current = answer.state;
        setState(current);
        writeSession(current);
        watch.watch(current);
      }
      return answer;
    },
    watchAgain: () => watch.watch(current),
  };
};

/** The event of a screen, with the wall time, the play day, and the current settings of a list-open. */
const screenEvent = (type: ScreenEvent, state: SessionState, now: number): SessionEvent => {
  if (type === 'load-failed') {
    return { type, now };
  }
  const day = dayOf(state, now);
  return type === 'list-open' ? { type, now, day, settings: loadSessionSettings() } : { type, now, day };
};

type Counter = {
  readonly count: (on: boolean) => void;
  readonly hide: () => void;
  readonly show: () => void;
};

/** The count of the play time: it counts while a counted screen shows and the page is visible, with a tick every
 * TICK_MS. `hide` and `show` only stop and start the count: the caller sends the hide and the show. */
const counter = (now: () => number, apply: (event: SessionEvent) => SessionAnswer): Counter => {
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
    count: (on) => {
      counting = on;
      if (visible) {
        countNow(on);
      }
    },
    hide: () => {
      visible = false;
      clearInterval(tickTimer);
    },
    show: () => {
      visible = true;
      if (counting) {
        countNow(true);
      }
    },
  };
};

/** Makes the controller of this run from the stored state. `now` gives the wall time in ms. */
export const createSession = (now: () => number = Date.now): SessionController => {
  let titleShown = false;
  const [toNight, setToNight] = createSignal(false);
  // The store calls it from the timer of the last start time, after this function returns.
  const titleShow = (): void => {
    if (!titleShown) {
      return;
    }
    const at = now();
    const before = current();
    const after = apply({ type: 'title-show', now: at, day: dayOf(before, at), settings: loadSessionSettings() });
    if (after.state !== before) {
      setToNight(true);
    }
  };
  const { state, restTimeOver: overAccessor, current, apply, watchAgain } = sessionStore(now, titleShow);
  const count = counter(now, apply);
  return {
    state,
    restTimeOver: overAccessor,
    toNight,
    now,
    day: () => dayOf(current(), now()),
    send: (type) => apply(screenEvent(type, current(), now())),
    count: (on) => {
      setToNight(false);
      count.count(on);
    },
    title: (shown) => {
      titleShown = shown;
      titleShow();
    },
    hide: () => {
      count.hide();
      apply({ type: 'hide', now: now() });
      // iOS can end a hidden app with no other event, so the state is written also when the hide changed nothing.
      writeSession(current());
    },
    show: () => {
      const at = now();
      apply({ type: 'show', now: at, day: dayOf(current(), at) });
      count.show();
      watchAgain();
      titleShow();
    },
  };
};
