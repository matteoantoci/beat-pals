import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_SETTINGS,
  endStage,
  parentStatus,
  restTimeOver,
  restoreSession,
  restoreSessionSettings,
  sessionAfter,
  SONG_ALLOWANCE_MS,
  storedSession,
  storedSessionSettings,
} from '../index';
import type {
  PlayDay,
  SessionAnswer,
  SessionEvent,
  SessionSettings,
  SessionState,
  SunStage,
  SunStep,
  Today,
} from '../index';

const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;
const DAY = 24 * H;

/** A wall time: the day number, and the hours and minutes of the clock of the test. */
const at = (day: number, hours: number, minutes = 0): number => day * DAY + hours * H + minutes * MIN;

/**
 * The play day of a wall time on the clock of the test: a day start at 5:00 every 24 h. The shell calculates it from
 * the local calendar (src/shell/play-day.ts). The stop time is the stop of the settings.
 */
const dayOf = (now: number, settings: SessionSettings = DEF): PlayDay => {
  const day = Math.floor((now - 5 * H) / DAY);
  return { start: at(day, 5), stop: day * DAY + settings.stopMinutes * MIN, next: at(day + 1, 5) };
};

/** The defaults: 15 minutes, 3 sessions per day, a rest time of 1 h, and a stop time at 20:00. */
const DEF: SessionSettings = DEFAULT_SESSION_SETTINGS;
const TEN: SessionSettings = { ...DEF, minutes: 10 };

const listOpen = (now: number, settings: SessionSettings = DEF): SessionEvent => ({
  type: 'list-open',
  now,
  day: dayOf(now, settings),
  settings,
});
const titleShow = (now: number, settings: SessionSettings = DEF): SessionEvent => ({
  type: 'title-show',
  now,
  day: dayOf(now, settings),
  settings,
});
const songStart = (now: number): SessionEvent => ({ type: 'song-start', now, day: dayOf(now) });
const goodbye = (now: number, settings: SessionSettings = DEF): SessionEvent => ({
  type: 'goodbye',
  now,
  day: dayOf(now, settings),
});
const show = (now: number): SessionEvent => ({ type: 'show', now, day: dayOf(now) });
const wakeTap = (now: number): SessionEvent => ({ type: 'wake-tap', now, day: dayOf(now) });
const openNow = (now: number): SessionEvent => ({ type: 'open-now', now, day: dayOf(now) });

/** A morning time of the first play day, for the tests where the clock time does not matter. */
const T = at(0, 10);

/** The state at the first start of the app: awake, with no stored session. */
const FIRST: SessionState = restoreSession(null, T, dayOf(T));

/** Sends the events in order and gives the answer to the last event. */
const run = (state: SessionState, events: readonly SessionEvent[]): SessionAnswer =>
  events.reduce<SessionAnswer>((answer, event) => sessionAfter(answer.state, event), {
    state,
    step: null,
    last: false,
  });

/** The ticks of the shell every 15 s while the time counts, from `from` to `to`. */
const ticks = (from: number, to: number): SessionEvent[] => {
  const events: SessionEvent[] = [];
  for (let now = from + 15 * S; now < to; now += 15 * S) {
    events.push({ type: 'tick', now });
  }
  events.push({ type: 'tick', now: to });
  return events;
};

/** The time used of an open session, in ms. */
const usedOf = (state: SessionState): number => (state.kind === 'open' ? state.usedMs : Number.NaN);

/** The asleep-until time of a state, or NaN when the state is not asleep. */
const untilOf = (state: SessionState): number => (state.kind === 'asleep' ? state.until : Number.NaN);

/** A session that opened at `at` with the settings, as the song list gives it. */
const opened = (from: number, settings: SessionSettings = TEN, state: SessionState = FIRST): SessionState =>
  sessionAfter(state, listOpen(from, settings)).state;

/** The play of a session in `session`: the settings (the defaults), and the time that it counts (15 minutes). */
type Play = { readonly settings?: SessionSettings; readonly ms?: number };

/**
 * One whole session from `from`: a wake tap when the pals sleep, a list-open, a play of `ms`, and the goodbye.
 */
const session = (state: SessionState, from: number, { settings = DEF, ms = 15 * MIN }: Play = {}): SessionState =>
  run(state, [wakeTap(from), listOpen(from, settings), ...ticks(from, from + ms), goodbye(from + ms, settings)]).state;

/** A session that opened at `from` and counted 5 minutes, and then a hide. */
const played = (from: number, settings: SessionSettings = DEF, state: SessionState = FIRST): SessionState =>
  run(opened(from, settings, state), [...ticks(from, from + 5 * MIN), { type: 'hide', now: from + 5 * MIN }]).state;

describe('the count of play time', () => {
  it('counts from the list-open, and a tick adds the counted step', () => {
    const answer = run(opened(T), ticks(T, T + 45 * S));

    expect(answer.state.kind).toBe('open');
    expect(usedOf(answer.state)).toBe(45 * S);
  });

  it('counts only between count-start and count-stop', () => {
    const answer = run(opened(T), [
      { type: 'tick', now: T + 10 * S },
      { type: 'count-stop', now: T + 20 * S },
      { type: 'tick', now: T + 50 * S },
      { type: 'count-start', now: T + 2 * MIN },
      { type: 'tick', now: T + 2 * MIN + 15 * S },
    ]);

    expect(usedOf(answer.state)).toBe(35 * S);
  });

  it('counts only between show and hide, and the shell starts the count again after a show', () => {
    const answer = run(opened(T), [
      { type: 'hide', now: T + 30 * S },
      { type: 'tick', now: T + 40 * S },
      show(T + 5 * MIN),
      { type: 'tick', now: T + 5 * MIN + 10 * S },
      { type: 'count-start', now: T + 6 * MIN },
      { type: 'tick', now: T + 6 * MIN + 15 * S },
    ]);

    expect(usedOf(answer.state)).toBe(45 * S);
  });

  it('counts 0 for a clock that goes back, and 0 for one step over 60 s', () => {
    const answer = run(opened(T + 10 * MIN), [
      { type: 'tick', now: T + 9 * MIN },
      { type: 'tick', now: T + 9 * MIN + 60 * S },
      { type: 'tick', now: T + 9 * MIN + 121 * S },
      { type: 'tick', now: T + 9 * MIN + 136 * S },
    ]);

    expect(usedOf(answer.state)).toBe(75 * S);
  });
});

/** The answer to a list-open at `T + after`, after the time counted from the list-open at T. */
const listAfter = (after: number, settings: SessionSettings = TEN): SessionAnswer =>
  run(opened(T, settings), [...ticks(T, T + after), listOpen(T + after, settings)]);

const stageOf = (state: SessionState): SunStage | SessionState['kind'] =>
  state.kind === 'open' ? state.shownStage : state.kind;

describe('the sun stage', () => {
  it('with 5 minutes, shows day at the first list and sunset at the next list', () => {
    const five = { ...DEF, minutes: 5 } as const;
    expect(stageOf(opened(T, five))).toBe('day');

    const next = listAfter(15 * S, five);

    expect(stageOf(next.state)).toBe('sunset');
    const dayToSunset: SunStep = { from: 'day', to: 'sunset' };
    expect(next.step).toEqual(dayToSunset);
  });

  it('with 10 minutes, shows late afternoon from 200 s and sunset over 300 s', () => {
    expect(listAfter(199 * S)).toMatchObject({ step: null, state: { shownStage: 'day' } });
    expect(listAfter(200 * S)).toMatchObject({
      step: { from: 'day', to: 'afternoon' },
      state: { shownStage: 'afternoon' },
    });
    expect(listAfter(300 * S)).toMatchObject({ state: { shownStage: 'afternoon' } });
    expect(listAfter(301 * S)).toMatchObject({ step: { from: 'day', to: 'sunset' }, state: { shownStage: 'sunset' } });
  });

  it('shows sunset when the time used reaches the limit', () => {
    expect(listAfter(30 * MIN, { ...DEF, minutes: 30 })).toMatchObject({ state: { shownStage: 'sunset' } });
  });

  it('changes only at a list-open, and gives each of the 3 steps', () => {
    const afternoon = run(opened(T), [...ticks(T, T + 250 * S)]);
    expect(stageOf(afternoon.state)).toBe('day');

    const first = sessionAfter(afternoon.state, listOpen(T + 250 * S, TEN));
    expect(first.step).toEqual({ from: 'day', to: 'afternoon' });

    const again = sessionAfter(first.state, listOpen(T + 250 * S, TEN));
    expect(again.step).toBeNull();

    const sunset = run(again.state, [...ticks(T + 250 * S, T + 320 * S), listOpen(T + 320 * S, TEN)]);
    expect(sunset.step).toEqual({ from: 'afternoon', to: 'sunset' });
  });

  it('gives the stage at the end of a song: the stage that the next list-open gives', () => {
    const playing = run(opened(T), ticks(T, T + 250 * S)).state;

    expect(endStage(playing, T + 250 * S, dayOf(T))).toBe('afternoon');
    expect(endStage(playing, T + 260 * S, dayOf(T))).toBe('afternoon');
    expect(endStage(run(playing, ticks(T + 250 * S, T + 301 * S)).state, T + 301 * S, dayOf(T))).toBe('sunset');
    expect(endStage(opened(T), T + 10 * S, dayOf(T))).toBe('day');
  });
});

describe('the last song', () => {
  it('is a song start after a sunset list', () => {
    const sunset = listAfter(301 * S).state;

    expect(sessionAfter(sunset, songStart(T + 301 * S)).last).toBe(true);
  });

  it('is a song start after a late-afternoon list only when the time used reached the limit', () => {
    const afternoon = listAfter(200 * S).state;
    const browse = (to: number): SessionAnswer => run(afternoon, [...ticks(T + 200 * S, T + to), songStart(T + to)]);

    expect(sessionAfter(afternoon, songStart(T + 200 * S)).last).toBe(false);
    expect(browse(599 * S).last).toBe(false);
    expect(browse(600 * S).last).toBe(true);
  });

  it('is not a song start after a day list', () => {
    expect(sessionAfter(opened(T), songStart(T + 30 * S)).last).toBe(false);
  });
});

/** The time used today of a state, in ms. */
const usedTodayOf = (state: SessionState): number => state.today.usedMs;

/** The time used in the play day of `now`. */
const todayAt = (now: number, usedMs = 0): Today => ({ start: dayOf(now).start, usedMs });

/** The limit of an open session, or NaN when no session is open. */
const limitOf = (state: SessionState): number => (state.kind === 'open' ? state.limitMs : Number.NaN);

/** The awake state with `usedMs` used in the first play day. */
const awakeWith = (usedMs: number): SessionState => ({ kind: 'awake', today: todayAt(T, usedMs), byParent: false });

/** The pals awake after "Open a new session now" at 21:00, after the stop time. */
const PARENT_EVENING: SessionState = sessionAfter(
  sessionAfter(FIRST, titleShow(at(0, 21))).state,
  openNow(at(0, 21))
).state;

describe('the start conditions', () => {
  it('opens a session at a list-open until the stop time minus the minutes of a session', () => {
    expect(opened(at(0, 19, 45), DEF).kind).toBe('open');
    expect(opened(at(0, 19, 30), { ...DEF, minutes: 30 }).kind).toBe('open');
  });

  it('gives asleep until the next day start for a list-open after the stop time minus the minutes', () => {
    const late = sessionAfter(FIRST, listOpen(at(0, 19, 45) + 1));

    expect(late).toEqual({ state: { kind: 'asleep', until: at(1, 5), today: todayAt(T) }, step: null, last: false });
    expect(untilOf(opened(at(0, 19, 31), { ...DEF, minutes: 30 }))).toBe(at(1, 5));
  });

  it('uses the minutes of the settings for the stop rule, not the limit of the session', () => {
    expect(untilOf(opened(at(0, 19, 50), DEF, awakeWith(40 * MIN)))).toBe(at(1, 5));
    expect(limitOf(opened(at(0, 19, 45), DEF, awakeWith(40 * MIN)))).toBe(5 * MIN);
  });

  it('opens a session only when the budget left is more than 0, and else sleeps until the next day start', () => {
    expect(sessionAfter(awakeWith(45 * MIN), listOpen(at(0, 15))).state).toEqual({
      kind: 'asleep',
      until: at(1, 5),
      today: todayAt(T, 45 * MIN),
    });
    expect(opened(at(0, 15), DEF, awakeWith(45 * MIN - 1)).kind).toBe('open');
  });

  it('with 1 minute left, shows the sunset at the first list, and the first song is the last song', () => {
    const first = sessionAfter(awakeWith(44 * MIN), listOpen(at(0, 15)));

    expect(first).toMatchObject({ step: null, state: { kind: 'open', limitMs: MIN, shownStage: 'sunset' } });
    expect(sessionAfter(first.state, songStart(at(0, 15))).last).toBe(true);
    expect(stageOf(opened(T, { ...DEF, minutes: 5 }))).toBe('day');
  });

  it('puts the pals to sleep at a title-show with the budget used, or after the stop time minus the minutes', () => {
    expect(untilOf(sessionAfter(awakeWith(45 * MIN), titleShow(at(0, 15))).state)).toBe(at(1, 5));
    expect(untilOf(sessionAfter(awakeWith(46 * MIN), titleShow(at(0, 15))).state)).toBe(at(1, 5));
    expect(untilOf(sessionAfter(FIRST, titleShow(at(0, 19, 46))).state)).toBe(at(1, 5));
    expect(untilOf(sessionAfter(FIRST, titleShow(at(0, 19, 31), { ...DEF, minutes: 30 })).state)).toBe(at(1, 5));
  });

  it('puts the pals to sleep at a title-show before 5:00, because the stop of that play day is past', () => {
    expect(sessionAfter(FIRST, titleShow(at(1, 3))).state).toEqual({
      kind: 'asleep',
      until: at(1, 5),
      today: todayAt(T),
    });
  });

  it('changes nothing at a title-show while a session can start', () => {
    const awake = awakeWith(30 * MIN);

    expect(sessionAfter(awake, titleShow(at(0, 19, 45))).state).toBe(awake);
    expect(sessionAfter(FIRST, titleShow(at(1, 5))).state).toBe(FIRST);
  });

  it('starts a new play day at 0 used', () => {
    const yesterday = awakeWith(45 * MIN);

    expect(sessionAfter(yesterday, titleShow(at(1, 5))).state).toBe(yesterday);
    expect(opened(at(1, 5), DEF, yesterday)).toMatchObject({
      kind: 'open',
      limitMs: 15 * MIN,
      today: { start: at(1, 5), usedMs: 0 },
    });
  });
});

describe('the day budget', () => {
  it('with 45 per day and 15 per session, is used by 3 sessions of 15 minutes, and then the pals sleep until 5:00', () => {
    const first = session(FIRST, at(0, 9));
    const second = session(first, at(0, 11));
    const third = session(second, at(0, 13));

    expect(first).toEqual({ kind: 'asleep', until: at(0, 10, 15), today: todayAt(T, 15 * MIN) });
    expect(second).toEqual({ kind: 'asleep', until: at(0, 12, 15), today: todayAt(T, 30 * MIN) });
    expect(third).toEqual({ kind: 'asleep', until: at(1, 5), today: todayAt(T, 45 * MIN) });
  });

  it('takes only the minutes that a session used', () => {
    expect(session(FIRST, at(0, 9), { ms: 5 * MIN })).toEqual({
      kind: 'asleep',
      until: at(0, 10, 5),
      today: todayAt(T, 5 * MIN),
    });
  });

  it('takes the last song past the limit, and gives the next session the minutes left as its limit', () => {
    const second = session(session(FIRST, at(0, 9)), at(0, 11), { ms: 20 * MIN });
    expect(usedTodayOf(second)).toBe(35 * MIN);

    const next = opened(at(0, 13), DEF, sessionAfter(second, wakeTap(at(0, 13))).state);
    expect(limitOf(next)).toBe(10 * MIN);
    expect(run(next, [...ticks(at(0, 13), at(0, 13, 5) + 1), listOpen(at(0, 13, 5) + 1)]).state).toMatchObject({
      shownStage: 'sunset',
    });
  });

  it('gives a session at most the minutes per day when they are fewer than the minutes per session', () => {
    expect(limitOf(opened(T, { ...DEF, minutes: 30, dayMinutes: 15 }))).toBe(15 * MIN);
  });

  it('sleeps until the next day start after a goodbye with the budget used, and a minute left gives the rest time', () => {
    const first = session(FIRST, at(0, 9));

    expect(untilOf(session(first, at(0, 11), { ms: 29 * MIN }))).toBe(at(0, 12, 29));
    expect(untilOf(session(first, at(0, 11), { ms: 30 * MIN }))).toBe(at(1, 5));
  });

  it('is not used by a session that the parent opened, but the rest time follows its goodbye', () => {
    const first = session(FIRST, at(0, 9));
    const byParent = session(sessionAfter(first, openNow(at(0, 9, 30))).state, at(0, 9, 30), { ms: 30 * MIN });

    expect(byParent).toEqual({ kind: 'asleep', until: at(0, 11), today: todayAt(T, 15 * MIN) });
  });

  it('applies the budget and the stop time to the goodbye of a session that the parent opened', () => {
    const used: SessionState = { kind: 'asleep', until: at(1, 5), today: todayAt(T, 45 * MIN) };

    expect(untilOf(session(sessionAfter(used, openNow(at(0, 15))).state, at(0, 15)))).toBe(at(1, 5));
    expect(untilOf(session(PARENT_EVENING, at(0, 21)))).toBe(at(1, 5));
  });
});

describe('the rest time', () => {
  it('ends the rest time of the settings after the goodbye', () => {
    expect(untilOf(session(FIRST, at(0, 10), { ms: MIN }))).toBe(at(0, 11, 1));
    expect(untilOf(session(FIRST, at(0, 10), { settings: { ...DEF, restMinutes: 30 }, ms: MIN }))).toBe(at(0, 10, 31));
    expect(untilOf(session(FIRST, at(0, 10), { settings: { ...DEF, restMinutes: 120 }, ms: MIN }))).toBe(at(0, 12, 1));
  });

  it('counts from the goodbye, so a long last song moves the end of the rest time', () => {
    const last = run(opened(T), [...ticks(T, T + 301 * S), listOpen(T + 301 * S, TEN), songStart(T + 301 * S)]);
    expect(last.last).toBe(true);

    const end = run(last.state, [...ticks(T + 301 * S, T + 9 * MIN), goodbye(T + 20 * MIN)]).state;
    expect(untilOf(end)).toBe(T + 80 * MIN);
  });

  it('ignores a wake tap before the end of the rest time, and wakes the pals after it', () => {
    const asleep = session(FIRST, at(0, 10), { ms: MIN });

    expect(restTimeOver(asleep, at(0, 11, 1) - 1)).toBe(false);
    expect(sessionAfter(asleep, wakeTap(at(0, 11, 1) - 1)).state).toBe(asleep);

    expect(restTimeOver(asleep, at(0, 11, 1))).toBe(true);
    expect(sessionAfter(asleep, wakeTap(at(0, 11, 1))).state).toEqual({
      kind: 'awake',
      today: todayAt(T, MIN),
      byParent: false,
    });
  });

  it('keeps the settings and the limit of the open session when the settings change', () => {
    const changed = run(opened(T, TEN), [
      ...ticks(T, T + 100 * S),
      listOpen(T + 100 * S, { minutes: 5, dayMinutes: 15, restMinutes: 120, stopMinutes: 1080 }),
    ]);
    expect(changed.state).toMatchObject({ shownStage: 'day', limitMs: 10 * MIN });

    expect(untilOf(sessionAfter(changed.state, goodbye(T + 100 * S)).state)).toBe(T + 100 * S + H);
  });
});

describe('the stop time', () => {
  it('sleeps until the next day start when the rest time ends after the stop time minus the minutes', () => {
    expect(untilOf(session(FIRST, at(0, 18, 30)))).toBe(at(0, 19, 45));
    expect(untilOf(session(FIRST, at(0, 18, 30), { ms: 15 * MIN + 1 }))).toBe(at(1, 5));
    expect(untilOf(session(FIRST, at(0, 18), { settings: { ...DEF, restMinutes: 120 } }))).toBe(at(1, 5));
  });

  it('shows the sunset at a list-open when the next song can end after the stop time', () => {
    const evening = run(opened(at(0, 19, 40), DEF), [
      ...ticks(at(0, 19, 40), at(0, 19, 41)),
      { type: 'count-stop', now: at(0, 19, 41) },
    ]).state;

    expect(sessionAfter(evening, listOpen(at(0, 19, 55))).state).toMatchObject({ shownStage: 'day' });
    expect(sessionAfter(evening, listOpen(at(0, 19, 55) + 1))).toMatchObject({
      step: { from: 'day', to: 'sunset' },
      state: { shownStage: 'sunset' },
    });
  });

  it('gives the last song at a song start at or after the stop time', () => {
    const evening = run(opened(at(0, 19, 40), DEF), [
      ...ticks(at(0, 19, 40), at(0, 19, 41)),
      { type: 'count-stop', now: at(0, 19, 41) },
      listOpen(at(0, 19, 50)),
    ]).state;

    expect(sessionAfter(evening, songStart(at(0, 20) - 1)).last).toBe(false);
    expect(sessionAfter(evening, songStart(at(0, 20))).last).toBe(true);
  });
});

describe('a session after "Open a new session now"', () => {
  const used: SessionState = { kind: 'asleep', until: at(1, 5), today: todayAt(T, 45 * MIN) };

  it('wakes the pals, also during the rest time, with the budget used, and after the stop time', () => {
    expect(sessionAfter(used, openNow(at(0, 21))).state).toEqual({
      kind: 'awake',
      today: todayAt(T, 45 * MIN),
      byParent: true,
    });
    expect(sessionAfter(session(FIRST, at(0, 9)), openNow(at(0, 9, 20))).state).toMatchObject({ byParent: true });
  });

  it('skips the budget and the start conditions, and the stop rules of the stage and of the last song', () => {
    const awake = sessionAfter(used, openNow(at(0, 21))).state;
    expect(sessionAfter(awake, titleShow(at(0, 21))).state).toBe(awake);

    const open = opened(at(0, 21), DEF, awake);
    expect(open).toMatchObject({ kind: 'open', byParent: true, limitMs: 15 * MIN });

    const later = run(open, [...ticks(at(0, 21), at(0, 21, 1)), listOpen(at(0, 21, 1))]);
    expect(later).toMatchObject({ step: null, state: { shownStage: 'day', today: todayAt(T, 45 * MIN) } });
    expect(sessionAfter(later.state, songStart(at(0, 21, 1))).last).toBe(false);
  });

  it('changes nothing while a session is open', () => {
    const open = run(opened(T), ticks(T, T + MIN)).state;

    expect(sessionAfter(open, openNow(T + MIN)).state).toEqual(open);
  });
});

describe('a play day', () => {
  it('on a school day, starts the sessions at 16:00, 17:20, and 18:40', () => {
    const first = session(FIRST, at(0, 16));
    const second = session(first, at(0, 17, 20));
    expect(sessionAfter(second, wakeTap(at(0, 18, 40))).state.kind).toBe('awake');

    const third = session(second, at(0, 18, 40));
    expect(third).toEqual({ kind: 'asleep', until: at(1, 5), today: todayAt(T, 45 * MIN) });
  });

  it('on a school day, refuses a start after 19:45 when the budget has minutes left', () => {
    const ninety = { ...DEF, dayMinutes: 90 } as const;
    const third = [at(0, 16), at(0, 17, 20), at(0, 18, 40)].reduce<SessionState>(
      (state, from) => session(state, from, { settings: ninety }),
      FIRST
    );

    expect(untilOf(third)).toBe(at(1, 5));
    expect(untilOf(sessionAfter(awakeWith(45 * MIN), listOpen(at(0, 19, 46), ninety)).state)).toBe(at(1, 5));
  });

  it('on a weekend, starts the sessions at 9:00, 13:00, and 17:00, and the next play day starts at 0 used', () => {
    const third = [at(0, 9), at(0, 13), at(0, 17)].reduce<SessionState>((state, from) => session(state, from), FIRST);
    expect(untilOf(third)).toBe(at(1, 5));
    expect(sessionAfter(third, wakeTap(at(1, 5) - 1)).state.kind).toBe('asleep');

    const morning = sessionAfter(third, wakeTap(at(1, 8)));
    expect(morning.state).toEqual({ kind: 'awake', today: todayAt(at(1, 8)), byParent: false });
    expect(session(morning.state, at(1, 9))).toEqual({
      kind: 'asleep',
      until: at(1, 10, 15),
      today: todayAt(at(1, 9), 15 * MIN),
    });
  });
});

describe('the hidden gap', () => {
  it('keeps the session open with its minutes left after a hide of 5 minutes', () => {
    const shown = sessionAfter(played(at(0, 10)), show(at(0, 10, 10))).state;

    expect(shown).toMatchObject({ kind: 'open', usedMs: 5 * MIN, hiddenAt: null });
    expect(usedOf(run(shown, [{ type: 'tick', now: at(0, 10, 11) }]).state)).toBe(5 * MIN);
  });

  it('ends a partly used session after a hide of the rest time, with first light, and takes only its minutes', () => {
    expect(sessionAfter(played(at(0, 10)), show(at(0, 11, 5) - 1)).state.kind).toBe('open');

    const shown = sessionAfter(played(at(0, 10)), show(at(0, 11, 5))).state;
    expect(shown).toEqual({ kind: 'asleep', until: at(0, 11, 5), today: todayAt(T, 5 * MIN) });
    expect(restTimeOver(shown, at(0, 11, 5))).toBe(true);

    const fresh = opened(at(0, 11, 6), DEF, sessionAfter(shown, wakeTap(at(0, 11, 6))).state);
    expect(fresh).toMatchObject({ kind: 'open', usedMs: 0, limitMs: 15 * MIN });
  });

  it('gives awake after a gap that ends a session with 0 used, and keeps a session of the parent out of the budget', () => {
    const empty = run(opened(at(0, 10)), [{ type: 'hide', now: at(0, 10) }, show(at(0, 11))]).state;
    expect(empty).toEqual({ kind: 'awake', today: todayAt(T), byParent: false });

    const awake = sessionAfter(session(FIRST, at(0, 9)), openNow(at(0, 9, 30))).state;
    const parentEmpty = run(opened(at(0, 9, 30), DEF, awake), [
      { type: 'hide', now: at(0, 9, 30) },
      show(at(0, 10, 30)),
    ]).state;
    expect(parentEmpty).toEqual({ kind: 'awake', today: todayAt(T, 15 * MIN), byParent: true });
  });

  it('keeps a session open at a show before the next day start when the budget is used', () => {
    const third = run(
      opened(at(0, 13), DEF, sessionAfter(session(session(FIRST, at(0, 9)), at(0, 11)), wakeTap(at(0, 13))).state),
      [...ticks(at(0, 13), at(0, 13, 15)), { type: 'hide', now: at(0, 13, 15) }, show(at(0, 15))]
    ).state;

    expect(third).toMatchObject({ kind: 'open', hiddenAt: null, today: todayAt(T, 45 * MIN) });
    expect(sessionAfter(third, songStart(at(0, 15))).last).toBe(true);
  });

  it('near the stop time, keeps the session open at a show before the stop time plus L, with the last song', () => {
    const shown = sessionAfter(played(at(0, 19, 30)), show(at(0, 20, 5) - 1)).state;
    expect(shown).toMatchObject({ kind: 'open', hiddenAt: null });

    const list = sessionAfter(shown, listOpen(at(0, 20, 5) - 1));
    expect(list.state).toMatchObject({ shownStage: 'sunset' });
    expect(sessionAfter(list.state, songStart(at(0, 20, 5) - 1)).last).toBe(true);
  });

  it('near the stop time, ends the session at a show at or after the stop time plus L', () => {
    const shown = sessionAfter(played(at(0, 19, 30)), show(at(0, 20, 5))).state;

    expect(shown).toEqual({ kind: 'asleep', until: at(1, 5), today: todayAt(T, 5 * MIN) });
  });

  it('gives awake at a show after the stop time plus L for a session with 0 used, and a title-show then sleeps', () => {
    const empty = run(opened(at(0, 19, 30)), [{ type: 'hide', now: at(0, 19, 30) }, show(at(0, 21))]).state;
    expect(empty).toEqual({ kind: 'awake', today: todayAt(T), byParent: false });

    expect(untilOf(sessionAfter(empty, titleShow(at(0, 21))).state)).toBe(at(1, 5));
  });

  it('ends a session at a show in a later play day, with the rest time over and 0 used', () => {
    const shown = sessionAfter(played(at(0, 10)), show(at(1, 9))).state;

    expect(shown).toMatchObject({ kind: 'asleep', today: todayAt(at(1, 9)) });
    expect(restTimeOver(shown, at(1, 9))).toBe(true);
  });

  it('keeps a session that the parent opened open after the stop time, and ends it in a later play day', () => {
    const hidden = played(at(0, 21), DEF, PARENT_EVENING);

    expect(sessionAfter(hidden, show(at(0, 23))).state).toMatchObject({ kind: 'open', hiddenAt: null });
    const shown = sessionAfter(hidden, show(at(1, 6))).state;
    expect(shown.kind).toBe('asleep');
    expect(restTimeOver(shown, at(1, 6))).toBe(true);
  });

  it('never ends a session for time on the visible title screen or in the parent area', () => {
    const idle = run(opened(T), [...ticks(T, T + MIN), { type: 'count-stop', now: T + MIN }, listOpen(T + 8 * H)]);

    expect(idle).toMatchObject({ step: null, state: { kind: 'open', usedMs: MIN, shownStage: 'day' } });
  });
});

/** The state after a write to localStorage and a restore at `now`. */
const reloaded = (state: SessionState, now: number): SessionState =>
  restoreSession(JSON.parse(JSON.stringify(storedSession(state))), now, dayOf(now));

describe('the restore of the stored state', () => {
  it('applies the gap rule with the stored time of the hide, after a kill', () => {
    const hidden = run(opened(T), [...ticks(T, T + MIN), { type: 'hide', now: T + MIN }]).state;

    expect(reloaded(hidden, T + 30 * MIN)).toMatchObject({ kind: 'open', usedMs: MIN, hiddenAt: null });
    expect(reloaded(hidden, T + H + MIN)).toEqual({ kind: 'asleep', until: T + H + MIN, today: todayAt(T, MIN) });
    expect(reloaded(hidden, at(1, 8))).toMatchObject({ kind: 'asleep', today: todayAt(at(1, 8)) });
  });

  it('never counts the gap as play time', () => {
    const counting = run(opened(T), ticks(T, T + MIN)).state;
    const restored = reloaded(counting, T + MIN + 30 * S);

    expect(usedOf(run(restored, [{ type: 'tick', now: T + MIN + 40 * S }]).state)).toBe(MIN);
    expect(
      usedOf(
        run(restored, [
          { type: 'count-start', now: T + 2 * MIN },
          { type: 'tick', now: T + 2 * MIN + 15 * S },
        ]).state
      )
    ).toBe(MIN + 15 * S);
  });

  describe('with a record of the last song', () => {
    const lastSong = run(opened(T, { ...DEF, minutes: 5 }), [
      ...ticks(T, T + 15 * S),
      listOpen(T + 15 * S),
      { type: 'count-stop', now: T + 15 * S },
      songStart(T + H),
    ]);

    it('gives the asleep state, so a reload never gives one more song', () => {
      expect(lastSong.last).toBe(true);
      expect(reloaded(lastSong.state, T + H + 100 * S)).toEqual({
        kind: 'asleep',
        until: T + 2 * H + 100 * S,
        today: todayAt(T, 15 * S),
      });
    });

    it('takes the start of the last song plus L as the goodbye time, when that is earlier than the restore', () => {
      expect(untilOf(reloaded(lastSong.state, T + 5 * H))).toBe(T + 2 * H + SONG_ALLOWANCE_MS);
    });

    it('loses the record after a failed load, so the session stays open', () => {
      const failed = sessionAfter(lastSong.state, { type: 'load-failed', now: T + H + 2 * S }).state;

      expect(reloaded(failed, T + H + 100 * S)).toMatchObject({ kind: 'open', lastSongAt: null });
    });
  });

  it('keeps the shown stage, which never goes back inside a session', () => {
    const stored = { ...storedSession(run(opened(T), ticks(T, T + MIN)).state), shownStage: 'sunset' };
    const answer = sessionAfter(restoreSession(stored, T + MIN, dayOf(T)), listOpen(T + MIN, TEN));

    expect(answer).toMatchObject({ step: null, state: { shownStage: 'sunset' } });
  });

  it('cuts an asleep-until more than 24 h ahead to now + 24 h, and counts a time of a hide later than now as now', () => {
    const asleep = storedSession({ kind: 'asleep', until: T + 40 * H, today: todayAt(T, MIN) });
    expect(restoreSession(asleep, T, dayOf(T))).toEqual({ kind: 'asleep', until: T + 24 * H, today: todayAt(T, MIN) });

    const hidden = storedSession({ ...run(opened(T), ticks(T, T + MIN)).state, hiddenAt: T + 5 * H } as SessionState);
    expect(restoreSession(hidden, T + MIN, dayOf(T))).toMatchObject({ kind: 'open', hiddenAt: null });
  });

  it('restores the time used of an earlier play day as 0 used', () => {
    expect(reloaded(awakeWith(45 * MIN), at(1, 8))).toEqual({
      kind: 'awake',
      today: todayAt(at(1, 8)),
      byParent: false,
    });
  });

  it('restores a version 1 asleep state with its asleep-until, and any other version 1 state as awake', () => {
    const v1Asleep = { version: 1, kind: 'asleep', until: T + 2 * H, starts: [T - 3 * H, T - H] };
    const v1Open = { ...storedSession(run(opened(T), ticks(T, T + MIN)).state), version: 1 };
    const v1Awake = { version: 1, kind: 'awake', starts: [T - H], byParent: true };

    expect(restoreSession(v1Asleep, T, dayOf(T))).toEqual({ kind: 'asleep', until: T + 2 * H, today: todayAt(T) });
    expect(restoreSession({ ...v1Asleep, until: T + 30 * H }, T, dayOf(T))).toMatchObject({ until: T + 24 * H });
    expect(restoreSession(v1Open, T, dayOf(T))).toEqual({ kind: 'awake', today: todayAt(T), byParent: false });
    expect(restoreSession(v1Awake, T, dayOf(T))).toEqual({ kind: 'awake', today: todayAt(T), byParent: false });
  });

  it('gives the awake state for a damaged or unknown state, and never throws', () => {
    const open = storedSession(run(opened(T), ticks(T, T + MIN)).state);
    const damaged: unknown[] = [
      undefined,
      null,
      'open',
      42,
      [],
      {},
      { ...open, version: 0 },
      { ...open, version: 3 },
      { ...open, kind: 'closed' },
      { ...open, usedMs: '60000' },
      { ...open, limitMs: 0 },
      { ...open, limitMs: Number.NaN },
      { ...open, settings: { minutes: 10, perDay: 3 } },
      { ...open, settings: { ...DEF, stopMinutes: 1201 } },
      { ...open, shownStage: 'night' },
      { ...open, today: { start: 'x', usedMs: 0 } },
      { ...open, today: { start: 0, usedMs: -1 } },
      { ...open, today: null },
      { version: 2, kind: 'asleep', until: null, today: todayAt(T) },
      { version: 2, kind: 'awake', today: todayAt(T), byParent: 'yes' },
      { version: 1, kind: 'asleep', until: 'soon', starts: [] },
    ];

    for (const stored of damaged) {
      expect(restoreSession(stored, T, dayOf(T))).toEqual({ kind: 'awake', today: todayAt(T), byParent: false });
    }
  });
});

describe('the restore of the stored settings', () => {
  it('keeps valid settings through the JSON of localStorage', () => {
    const settings: SessionSettings = { minutes: 25, dayMinutes: 60, restMinutes: 90, stopMinutes: 1110 };

    expect(restoreSessionSettings(JSON.parse(JSON.stringify(storedSessionSettings(settings))))).toEqual(settings);
  });

  it('gives the defaults of 15 minutes, 45 minutes a day, a rest time of 1 h, and a stop at 20:00 for no settings', () => {
    expect(DEFAULT_SESSION_SETTINGS).toEqual({ minutes: 15, dayMinutes: 45, restMinutes: 60, stopMinutes: 1200 });
    for (const stored of [undefined, null, 'ten', [], {}, { version: 2 }]) {
      expect(restoreSessionSettings(stored)).toEqual(DEFAULT_SESSION_SETTINGS);
    }
  });

  it('gives the defaults for the version 1 settings, because their sessions per day meant the even spacing', () => {
    expect(restoreSessionSettings({ minutes: 25, perDay: 2 })).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('gives the default only for the damaged field', () => {
    const stored = storedSessionSettings({ minutes: 5, dayMinutes: 90, restMinutes: 30, stopMinutes: 1260 });

    expect(restoreSessionSettings({ ...stored, dayMinutes: 50 })).toEqual({
      minutes: 5,
      dayMinutes: 45,
      restMinutes: 30,
      stopMinutes: 1260,
    });
    expect(restoreSessionSettings({ ...stored, restMinutes: 45, stopMinutes: '20:00' })).toEqual({
      minutes: 5,
      dayMinutes: 90,
      restMinutes: 60,
      stopMinutes: 1200,
    });
  });
});

describe('the status line of the parent area', () => {
  it('gives the minutes used today, and the minutes used and the limit of an open session', () => {
    const first = session(FIRST, at(0, 9));
    const open = run(opened(at(0, 11), TEN, sessionAfter(first, wakeTap(at(0, 11))).state), [
      ...ticks(at(0, 11), at(0, 11, 6) + 30 * S),
    ]).state;

    expect(parentStatus(open, { now: at(0, 11, 6) + 30 * S, day: dayOf(at(0, 11)), settings: DEF })).toEqual({
      kind: 'open',
      usedTodayMinutes: 21,
      dayMinutes: 45,
      byParent: false,
      usedMinutes: 6,
      limitMinutes: 10,
    });
  });

  it('does not add the minutes of a session that the parent opened to the minutes used today', () => {
    const awake = sessionAfter(session(FIRST, at(0, 9)), openNow(at(0, 10))).state;
    const open = run(opened(at(0, 10), DEF, awake), ticks(at(0, 10), at(0, 10, 3))).state;

    expect(parentStatus(open, { now: at(0, 10, 3), day: dayOf(at(0, 10)), settings: DEF })).toMatchObject({
      usedTodayMinutes: 15,
      usedMinutes: 3,
      byParent: true,
    });
  });

  it('gives the minutes used today while the pals are awake, and 0 in a new play day', () => {
    const awake = sessionAfter(session(FIRST, at(0, 9)), wakeTap(at(0, 11))).state;

    expect(
      parentStatus(awake, { now: at(0, 11), day: dayOf(at(0, 11)), settings: { ...DEF, dayMinutes: 60 } })
    ).toEqual({
      kind: 'awake',
      usedTodayMinutes: 15,
      dayMinutes: 60,
      byParent: false,
    });
    expect(parentStatus(awake, { now: at(1, 6), day: dayOf(at(1, 6)), settings: DEF })).toMatchObject({
      usedTodayMinutes: 0,
    });
  });

  it('gives the minutes that the pals still sleep, and rest-time-over after the rest time', () => {
    const asleep = session(FIRST, at(0, 9));

    expect(parentStatus(asleep, { now: at(0, 9, 35), day: dayOf(at(0, 9)), settings: DEF })).toEqual({
      kind: 'asleep',
      minutesLeft: 40,
      untilDayStart: false,
    });
    expect(parentStatus(asleep, { now: at(0, 9, 35) - 30 * S, day: dayOf(at(0, 9)), settings: DEF })).toMatchObject({
      minutesLeft: 41,
    });
    expect(parentStatus(asleep, { now: at(0, 10, 15), day: dayOf(at(0, 9)), settings: DEF })).toEqual({
      kind: 'rest-time-over',
    });
  });

  it('tells when the pals sleep until the next day start', () => {
    const night = sessionAfter(FIRST, titleShow(at(0, 21))).state;

    expect(parentStatus(night, { now: at(0, 21), day: dayOf(at(0, 21)), settings: DEF })).toEqual({
      kind: 'asleep',
      minutesLeft: 480,
      untilDayStart: true,
    });
  });
});
