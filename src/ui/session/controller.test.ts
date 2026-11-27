import { describe, expect, it } from 'vitest';
import { createDeviceStorage, memoryAdapter } from '../../shell/storage';
import { STORAGE_KEYS } from '../../shell/storage/keys';
import { createSession } from './controller';
import { TICK_MS } from './counter';
import type { PlayDay, SessionState } from '../../model';
import type { DeviceStorage } from '../../shell/storage';
import type { SessionController } from './controller';
import type { Clock, Timers } from './ports';

// The session controller with a fake clock, fake timers, and the device storage on the memory adapter. The signals
// of Solid update at once in node (the server build), so a test reads them right after an action.

const MIN = 60_000;
const H = 60 * MIN;
const DAY = 24 * H;

/** A wall time: the day number, and the hours and minutes of the clock of the test. */
const at = (day: number, hours: number, minutes = 0): number => day * DAY + hours * H + minutes * MIN;

/** The play day on the clock of the test: a day start at 5:00 every 24 h. */
const playDay = (now: number, stopMinutes: number): PlayDay => {
  const day = Math.floor((now - 5 * H) / DAY);
  return { start: at(day, 5), stop: day * DAY + stopMinutes * MIN, next: at(day + 1, 5) };
};

type Timer = { readonly at: number; readonly run: () => void; readonly every: number | null };

type FakePage = {
  readonly clock: Clock;
  readonly timers: Timers;
  /** Moves the clock by `ms`, and runs each timer at its time. */
  readonly advance: (ms: number) => void;
  /** The number of timers that wait. */
  readonly pending: () => number;
};

/** A fake page: a clock that moves only at `advance`, and timers that run in the order of their times. */
const fakePage = (start: number): FakePage => {
  let now = start;
  let nextId = 1;
  const timers = new Map<number, Timer>();
  const add = (run: () => void, ms: number, every: number | null): number => {
    const id = nextId;
    nextId += 1;
    timers.set(id, { at: now + ms, run, every });
    return id;
  };
  const clear = (id: number | undefined): void => {
    timers.delete(id ?? 0);
  };
  const due = (end: number): [number, Timer] | undefined =>
    [...timers].filter(([, timer]) => timer.at <= end).toSorted(([, a], [, b]) => a.at - b.at)[0];
  const fire = (id: number, timer: Timer): void => {
    now = timer.at;
    timers.delete(id);
    if (timer.every !== null) {
      timers.set(id, { ...timer, at: timer.at + timer.every });
    }
    timer.run();
  };
  const clock: Clock = { now: () => now, day: playDay };
  const page: Timers = {
    setTimeout: (run, ms) => add(run, ms, null),
    clearTimeout: clear,
    setInterval: (run, ms) => add(run, ms, ms),
    clearInterval: clear,
  };
  return {
    clock,
    timers: page,
    /** Moves the clock by `ms`, and runs each timer at its time. */
    advance: (ms: number): void => {
      const end = now + ms;
      for (let next = due(end); next; next = due(end)) {
        fire(...next);
      }
      now = end;
    },
    pending: (): number => timers.size,
  };
};

type Run = {
  readonly session: SessionController;
  readonly page: FakePage;
  readonly storage: DeviceStorage;
  /** The stored form of the state, as the next launch reads it. */
  readonly stored: () => unknown;
};

/** A controller at `start` on a storage that holds `state`, or no state. */
const launch = (start: number, state?: SessionState, visible = true): Run => {
  const texts = new Map<string, string>();
  const storage = createDeviceStorage(memoryAdapter(texts));
  if (state) {
    storage.session.write(state);
  }
  const page = fakePage(start);
  const session = createSession({ clock: page.clock, timers: page.timers, visible, store: storage.session });
  const stored = (): unknown => JSON.parse(texts.get(STORAGE_KEYS.session) ?? 'null');
  return { session, page, storage, stored };
};

const today = { start: at(0, 5), usedMs: 0 };

/** The time used in the open session, or -1 when no session is open. */
const usedOf = (state: SessionState): number => (state.kind === 'open' ? state.usedMs : -1);

describe('the end of the rest time', () => {
  it('turns restTimeOver true at the asleep-until, also with no screen event', () => {
    const { session, page } = launch(at(0, 10), { kind: 'asleep', until: at(0, 10, 30), today });
    expect(session.restTimeOver()).toBe(false);
    page.advance(30 * MIN - 1);
    expect(session.restTimeOver()).toBe(false);
    page.advance(1);
    expect(session.restTimeOver()).toBe(true);
    expect(page.pending()).toBe(0);
  });

  it('lets a wake-tap wake the pals only after it', () => {
    const { session, page } = launch(at(0, 10), { kind: 'asleep', until: at(0, 10, 30), today });
    expect(session.send('wake-tap').state.kind).toBe('asleep');
    page.advance(30 * MIN);
    expect(session.send('wake-tap').state).toEqual({ kind: 'awake', today, byParent: false });
  });
});

describe('the end of the last start time', () => {
  it('puts the pals to sleep on the normal title, 1 ms after the last start time', () => {
    const { session, page, stored } = launch(at(0, 19));
    session.title(true);
    expect(session.state().kind).toBe('awake');
    page.advance(45 * MIN);
    expect(session.state().kind).toBe('awake');
    expect(session.toNight()).toBe(false);
    page.advance(1);
    expect(session.state()).toEqual({ kind: 'asleep', until: at(1, 5), today });
    expect(session.toNight()).toBe(true);
    expect(stored()).toMatchObject({ kind: 'asleep', until: at(1, 5), today });
  });

  it('changes nothing while another screen shows, and the next title puts the pals to sleep', () => {
    const { session, page } = launch(at(0, 19));
    page.advance(H);
    expect(session.state().kind).toBe('awake');
    expect(page.pending()).toBe(0);
    session.title(true);
    expect(session.state().kind).toBe('asleep');
    expect(session.toNight()).toBe(true);
  });

  it('uses the current settings of the parent area', () => {
    const { session, storage } = launch(at(0, 19, 35));
    session.title(true);
    expect(session.state().kind).toBe('awake');
    session.title(false);
    storage.session.storeSettings({ ...storage.session.settings(), minutes: 30 });
    session.title(true);
    expect(session.state().kind).toBe('asleep');
  });

  it('sets no timer for a session that the parent opened', () => {
    const { session, page } = launch(at(0, 19), { kind: 'awake', today, byParent: true });
    session.title(true);
    page.advance(2 * H);
    expect(session.state().kind).toBe('awake');
    expect(page.pending()).toBe(0);
  });
});

describe('the count of the play time', () => {
  it('counts with a tick while a counted screen shows and the page is visible', () => {
    const { session, page } = launch(at(0, 10));
    session.send('list-open');
    session.count(true);
    page.advance(4 * TICK_MS);
    expect(usedOf(session.state())).toBe(4 * TICK_MS);
    session.count(false);
    page.advance(4 * TICK_MS);
    expect(usedOf(session.state())).toBe(4 * TICK_MS);
    expect(page.pending()).toBe(0);
  });

  it('sets no tick while the page starts hidden, and starts the count at the show', () => {
    const { session, page } = launch(at(0, 10), { kind: 'awake', today, byParent: true }, false);
    session.count(true);
    expect(page.pending()).toBe(0);
    session.show();
    expect(page.pending()).toBe(1);
  });
});

describe('the hide and the show', () => {
  it('stops the count and writes the state at the hide, and counts again after the show', () => {
    const { session, page, stored } = launch(at(0, 10));
    session.send('list-open');
    session.count(true);
    page.advance(TICK_MS);
    session.hide();
    expect(stored()).toMatchObject({ kind: 'open', usedMs: TICK_MS, hiddenAt: at(0, 10) + TICK_MS });
    // A move to another counted screen while the page is hidden does not start the count.
    session.count(true);
    page.advance(10 * MIN);
    expect(usedOf(session.state())).toBe(TICK_MS);
    // The show applies the gap rule first, so the count-start after it is not refused for a hidden page.
    session.show();
    expect(session.state()).toMatchObject({ kind: 'open', hiddenAt: null });
    page.advance(TICK_MS);
    expect(usedOf(session.state())).toBe(2 * TICK_MS);
  });

  it('writes the state at each hide, also when the hide changes nothing', () => {
    const asleep: SessionState = { kind: 'asleep', until: at(0, 11), today };
    const { session, storage, stored } = launch(at(0, 10), asleep);
    storage.session.write({ kind: 'awake', today, byParent: false });
    session.hide();
    expect(stored()).toMatchObject(asleep);
  });

  it('ends the session at a show after the rest time', () => {
    const { session, page } = launch(at(0, 10));
    session.send('list-open');
    session.count(true);
    page.advance(TICK_MS);
    session.hide();
    page.advance(2 * H);
    session.show();
    expect(session.state()).toMatchObject({ kind: 'asleep', until: at(0, 11) + TICK_MS });
    expect(session.restTimeOver()).toBe(true);
  });
});
