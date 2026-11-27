import { createSignal } from 'solid-js';
import { endStage, parentStatus } from '../../model';
import { counter } from './counter';
import { stateStore } from './session-state';
import type { SessionAnswer, SessionEvent, SessionState, SessionStatus, SessionTime, SunStage } from '../../model';
import type { SessionPorts } from './ports';
import type { Accessor } from 'solid-js';

// The session controller: the seam between the screens and the session model (play-sessions spec, "Session rules",
// changed by the session-schedule spec). It holds the session state of this run, gives each event the wall time and
// the play day, and writes the state at each change and at each hide. The time counts only while a counted screen
// shows (App calls `count`) and the page is visible, and a tick goes to the model every TICK_MS while it counts. While
// the normal title shows (the title screen calls `title`), the model gets a title-show at once, and again at each
// change by time alone that the model gives (./session-state.ts). The page parts come from the caller (./ports.ts).
//
// One rule for the screens: a screen decides only from the answer of `send`. The signals (`state`, `restTimeOver`,
// `toNight`) only show the screens: a read of a signal right after `send` gives the old value until the next flush.
// The facts (`endStage`, `status`) come from the state of the controller, not from the signal.

/** The events that a screen sends. The controller adds the wall time, the play day, and the settings. */
type ScreenEvent = 'list-open' | 'song-start' | 'load-failed' | 'goodbye' | 'open-now' | 'wake-tap';

export type SessionController = {
  /** The session state of this run, to show the screens. */
  readonly state: Accessor<SessionState>;
  /** The pals sleep and the rest time is over. It turns true at the end of the rest time, also while a screen shows. */
  readonly restTimeOver: Accessor<boolean>;
  /** True from a title-show that put the pals to sleep until the next move to a screen: the title fades to night. */
  readonly toNight: Accessor<boolean>;
  /** Sends an event of a screen. Gives the answer of the model (the state, the step of the sun, the last song). */
  readonly send: (type: ScreenEvent) => SessionAnswer;
  /** The stage of the sun at the end of a song, now. */
  readonly endStage: () => SunStage;
  /** The facts of the status line of the parent area, now. */
  readonly status: () => SessionStatus;
  /** A counted screen shows (true), or a screen that does not count (false). */
  readonly count: (on: boolean) => void;
  /** The normal title shows (true), or it does not show (false). */
  readonly title: (shown: boolean) => void;
  /** The page is hidden. */
  readonly hide: () => void;
  /** The page is visible again. */
  readonly show: () => void;
};

/** The event of a screen, with the wall time, the play day, and the current settings of a list-open. */
const screenEvent = (type: ScreenEvent, { now, day, settings }: SessionTime): SessionEvent => {
  if (type === 'load-failed') {
    return { type, now };
  }
  return type === 'list-open' ? { type, now, day, settings } : { type, now, day };
};

/** Makes the controller of this run on the page parts. It reads the stored state once, and the settings at each event. */
export const createSession = (ports: SessionPorts): SessionController => {
  const { clock, store } = ports;
  let titleShown = false;
  const [toNight, setToNight] = createSignal(false);
  // The state store calls it at each change by time alone, after this function returns.
  const titleShow = (): void => {
    if (!titleShown) {
      return;
    }
    const before = current();
    const after = apply({ type: 'title-show', ...time() });
    if (after.state !== before) {
      setToNight(true);
    }
  };
  const { state, restTimeOver, current, time, apply, watch } = stateStore(ports, titleShow);
  const count = counter(ports, apply);
  return {
    state,
    restTimeOver,
    toNight,
    send: (type) => apply(screenEvent(type, time())),
    endStage: () => {
      const { now, day } = time();
      return endStage(current(), now, day);
    },
    status: () => parentStatus(current(), time()),
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
      apply({ type: 'hide', now: clock.now() });
      // iOS can end a hidden app with no other event, so the state is written also when the hide changed nothing.
      store.write(current());
    },
    show: () => {
      const { now, day } = time();
      apply({ type: 'show', now, day });
      count.show();
      watch();
      titleShow();
    },
  };
};
