import type { SessionAnswer, SessionEvent } from '../../model';
import type { SessionPorts } from './ports';

/** While the time counts, the model gets a tick at least this often. */
export const TICK_MS = 15_000;

/** The parts of the page that the counter uses. */
type CounterPorts = Pick<SessionPorts, 'clock' | 'timers' | 'visible'>;

type Counter = {
  readonly count: (on: boolean) => void;
  readonly hide: () => void;
  readonly show: () => void;
};

/**
 * The count of the play time: it counts while a counted screen shows and the page is visible, with a tick every
 * TICK_MS. `hide` and `show` only stop and start the count: the caller sends the hide and the show.
 */
export const counter = (ports: CounterPorts, apply: (event: SessionEvent) => SessionAnswer): Counter => {
  const { clock, timers } = ports;
  let tickTimer: number | undefined;
  let counting = false;
  let visible = ports.visible;
  const countNow = (on: boolean): void => {
    timers.clearInterval(tickTimer);
    apply({ type: on ? 'count-start' : 'count-stop', now: clock.now() });
    if (on) {
      tickTimer = timers.setInterval(() => apply({ type: 'tick', now: clock.now() }), TICK_MS);
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
      timers.clearInterval(tickTimer);
    },
    show: () => {
      visible = true;
      if (counting) {
        countNow(true);
      }
    },
  };
};
