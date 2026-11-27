import { createSignal } from 'solid-js';
import { nextChange, restTimeOver, sessionAfter } from '../../model';
import type { SessionAnswer, SessionEvent, SessionState, SessionTime } from '../../model';
import type { SessionPorts } from './ports';
import type { Accessor } from 'solid-js';

type StateStore = {
  readonly state: Accessor<SessionState>;
  readonly restTimeOver: Accessor<boolean>;
  /** The state now. A read of the signal gives the new value only after the next flush, so the store keeps it here. */
  readonly current: () => SessionState;
  /** The wall time now, its play day for the current state, and the current settings. */
  readonly time: () => SessionTime;
  /** Gives the event to the model, and keeps and writes the state when it changed. */
  readonly apply: (event: SessionEvent) => SessionAnswer;
  /** Sets `restTimeOver` and the timer of the next change by time again, for example after a show. */
  readonly watch: () => void;
};

/**
 * The session state of this run, read from storage, and the timer of its next change by time alone (the model gives
 * it: the end of the rest time, or the end of the last start time). At that time, the store calls `onTime` and then
 * asks the model again.
 */
export const stateStore = (ports: SessionPorts, onTime: () => void): StateStore => {
  const { clock, timers, store } = ports;
  const start = clock.now();
  let current = store.read(start, clock.day(start, store.settings().stopMinutes));
  const [state, setState] = createSignal<SessionState>(current);
  const [over, setOver] = createSignal(false);
  let timer: number | undefined;
  const time = (): SessionTime => {
    const now = clock.now();
    const settings = store.settings();
    // The stop time comes from the settings of the open session, because a change of a setting applies from the next
    // session. With no open session, it comes from the current settings.
    const stopMinutes = current.kind === 'open' ? current.settings.stopMinutes : settings.stopMinutes;
    return { now, day: clock.day(now, stopMinutes), settings };
  };
  const watch = (): void => {
    timers.clearTimeout(timer);
    const at = time();
    setOver(restTimeOver(current, at.now));
    const next = nextChange(current, at);
    timer = next
      ? timers.setTimeout(() => {
          onTime();
          watch();
        }, next.at - at.now)
      : undefined;
  };
  watch();
  return {
    state,
    restTimeOver: over,
    current: () => current,
    time,
    apply: (event) => {
      const answer = sessionAfter(current, event);
      if (answer.state !== current) {
        current = answer.state;
        setState(current);
        store.write(current);
        watch();
      }
      return answer;
    },
    watch,
  };
};
