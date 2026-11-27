import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_SETTINGS,
  endStage,
  parentStatus,
  restOver,
  restoreSession,
  restoreSessionSettings,
  sessionAfter,
  SONG_ALLOWANCE_MS,
  storedSession,
  WAKING_DAY_MS,
} from '../index';
import type { SessionAnswer, SessionEvent, SessionSettings, SessionState, SunStage, SunStep } from '../index';

const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;

const TEN: SessionSettings = { minutes: 10, perDay: 4 };

/** The state at the first start of the app: awake, with no stored session. */
const FIRST: SessionState = restoreSession(null, 0);

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

/** A session that opened at `at` with the settings, as the song list gives it. */
const opened = (at: number, settings: SessionSettings = TEN): SessionState =>
  sessionAfter(FIRST, { type: 'list-open', now: at, settings }).state;

describe('the count of play time', () => {
  it('counts from the list-open, and a tick adds the counted step', () => {
    const answer = run(opened(0), ticks(0, 45 * S));

    expect(answer.state.kind).toBe('open');
    expect(usedOf(answer.state)).toBe(45 * S);
  });

  it('counts only between count-start and count-stop', () => {
    const answer = run(opened(0), [
      { type: 'tick', now: 10 * S },
      { type: 'count-stop', now: 20 * S },
      { type: 'tick', now: 50 * S },
      { type: 'count-start', now: 2 * MIN },
      { type: 'tick', now: 2 * MIN + 15 * S },
    ]);

    expect(usedOf(answer.state)).toBe(35 * S);
  });

  it('counts only between show and hide, and the shell starts the count again after a show', () => {
    const answer = run(opened(0), [
      { type: 'hide', now: 30 * S },
      { type: 'tick', now: 40 * S },
      { type: 'show', now: 5 * MIN },
      { type: 'tick', now: 5 * MIN + 10 * S },
      { type: 'count-start', now: 6 * MIN },
      { type: 'tick', now: 6 * MIN + 15 * S },
    ]);

    expect(usedOf(answer.state)).toBe(45 * S);
  });

  it('counts 0 for a clock that goes back, and 0 for one step over 60 s', () => {
    const answer = run(opened(10 * MIN), [
      { type: 'tick', now: 9 * MIN },
      { type: 'tick', now: 9 * MIN + 60 * S },
      { type: 'tick', now: 9 * MIN + 121 * S },
      { type: 'tick', now: 9 * MIN + 136 * S },
    ]);

    expect(usedOf(answer.state)).toBe(75 * S);
  });
});

/** The answer to a list-open at `at`, after the time counted from the list-open at 0 up to `at`. */
const listAt = (at: number, settings: SessionSettings = TEN): SessionAnswer =>
  run(opened(0, settings), [...ticks(0, at), { type: 'list-open', now: at, settings }]);

const stageOf = (state: SessionState): SunStage | SessionState['kind'] =>
  state.kind === 'open' ? state.shownStage : state.kind;

describe('the sun stage', () => {
  it('with 5 minutes, shows day at the first list and sunset at the next list', () => {
    expect(stageOf(opened(0, { minutes: 5, perDay: 4 }))).toBe('day');

    const next = listAt(15 * S, { minutes: 5, perDay: 4 });

    expect(stageOf(next.state)).toBe('sunset');
    const dayToSunset: SunStep = { from: 'day', to: 'sunset' };
    expect(next.step).toEqual(dayToSunset);
  });

  it('with 10 minutes, shows late afternoon from 200 s and sunset over 300 s', () => {
    expect(listAt(199 * S)).toMatchObject({ step: null, state: { shownStage: 'day' } });
    expect(listAt(200 * S)).toMatchObject({
      step: { from: 'day', to: 'afternoon' },
      state: { shownStage: 'afternoon' },
    });
    expect(listAt(300 * S)).toMatchObject({ state: { shownStage: 'afternoon' } });
    expect(listAt(301 * S)).toMatchObject({ step: { from: 'day', to: 'sunset' }, state: { shownStage: 'sunset' } });
  });

  it('shows sunset when the time used reaches the limit', () => {
    expect(listAt(30 * MIN, { minutes: 30, perDay: 4 })).toMatchObject({ state: { shownStage: 'sunset' } });
  });

  it('changes only at a list-open, and gives each of the 3 steps', () => {
    const afternoon = run(opened(0), [...ticks(0, 250 * S)]);
    expect(stageOf(afternoon.state)).toBe('day');

    const first = sessionAfter(afternoon.state, { type: 'list-open', now: 250 * S, settings: TEN });
    expect(first.step).toEqual({ from: 'day', to: 'afternoon' });

    const again = sessionAfter(first.state, { type: 'list-open', now: 250 * S, settings: TEN });
    expect(again.step).toBeNull();

    const sunset = run(again.state, [...ticks(250 * S, 320 * S), { type: 'list-open', now: 320 * S, settings: TEN }]);
    expect(sunset.step).toEqual({ from: 'afternoon', to: 'sunset' });
  });

  it('gives the stage at the end of a song: the stage that the next list-open gives', () => {
    const playing = run(opened(0), ticks(0, 250 * S)).state;

    expect(endStage(playing, 250 * S)).toBe('afternoon');
    expect(endStage(playing, 260 * S)).toBe('afternoon');
    expect(endStage(run(playing, ticks(250 * S, 301 * S)).state, 301 * S)).toBe('sunset');
    expect(endStage(opened(0), 10 * S)).toBe('day');
  });
});

describe('the last song', () => {
  it('is a song start after a sunset list', () => {
    const sunset = listAt(301 * S).state;

    expect(sessionAfter(sunset, { type: 'song-start', now: 301 * S }).last).toBe(true);
  });

  it('is a song start after a late-afternoon list only when the time used reached the limit', () => {
    const afternoon = listAt(200 * S).state;
    const browse = (to: number): SessionAnswer =>
      run(afternoon, [...ticks(200 * S, to), { type: 'song-start', now: to }]);

    expect(sessionAfter(afternoon, { type: 'song-start', now: 200 * S }).last).toBe(false);
    expect(browse(599 * S).last).toBe(false);
    expect(browse(600 * S).last).toBe(true);
  });

  it('is not a song start after a day list', () => {
    expect(sessionAfter(opened(0), { type: 'song-start', now: 30 * S }).last).toBe(false);
  });
});

/** The asleep-until time of a state, or NaN when the state is not asleep. */
const untilOf = (state: SessionState): number => (state.kind === 'asleep' ? state.until : Number.NaN);

/**
 * One whole session from `at`: a wake tap when the pals sleep, a list-open, a play of 1 minute, and the goodbye.
 */
const session = (state: SessionState, at: number, settings: SessionSettings = TEN): SessionState =>
  run(state, [
    { type: 'wake-tap', now: at },
    { type: 'list-open', now: at, settings },
    ...ticks(at, at + MIN),
    { type: 'goodbye', now: at + MIN },
  ]).state;

describe('the goodbye and the rest time', () => {
  it('turns asleep at the goodbye, the start of the goodbye scene, not at the start of the last song', () => {
    const last = run(listAt(301 * S).state, [{ type: 'song-start', now: 301 * S }]).state;
    expect(last.kind).toBe('open');

    const goodbye = sessionAfter(run(last, ticks(301 * S, 9 * MIN)).state, { type: 'goodbye', now: 9 * MIN });
    expect(goodbye.state.kind).toBe('asleep');
  });

  it('spaces the sessions by WAKING_DAY divided by the sessions per day, from the session start', () => {
    expect(WAKING_DAY_MS).toBe(12 * H);
    // A session that the parent opened is not in the rolling cap, so only the spacing gives its rest time.
    const byParent = sessionAfter(session(FIRST, -2 * 24 * H), { type: 'open-now', now: 0 }).state;
    const spacings = ([1, 2, 3, 4, 5, 6] as const).map((perDay) =>
      untilOf(session(byParent, 0, { minutes: 5, perDay }))
    );

    expect(spacings).toEqual([12 * H, 6 * H, 4 * H, 3 * H, 2 * H + 24 * MIN, 2 * H]);
    expect(untilOf(session(FIRST, 0, { minutes: 5, perDay: 3 }))).toBe(4 * H);
  });

  it('with 1 session per day, sleeps 24 h after a counted session start: the rolling cap is longer than 12 h', () => {
    expect(untilOf(session(FIRST, 0, { minutes: 5, perDay: 1 }))).toBe(24 * H);
  });

  it('gives asleep-until at the goodbye for a session longer than its spacing, so the rest time is over at once', () => {
    const long = run(opened(0, { minutes: 10, perDay: 6 }), [
      ...ticks(0, MIN),
      { type: 'count-stop', now: MIN },
      { type: 'goodbye', now: 2 * H + 30 * MIN },
    ]).state;

    expect(untilOf(long)).toBe(2 * H + 30 * MIN);
    expect(restOver(long, 2 * H + 30 * MIN)).toBe(true);
  });

  it('refuses a 5th start of 4 sessions in 24 h until the oldest start leaves the window', () => {
    const fourth = [0, 3 * H, 6 * H, 9 * H].reduce<SessionState>((state, at) => session(state, at), FIRST);

    expect(untilOf(fourth)).toBe(24 * H);
    expect(sessionAfter(fourth, { type: 'wake-tap', now: 12 * H }).state.kind).toBe('asleep');
    expect(sessionAfter(fourth, { type: 'wake-tap', now: 15 * H }).state.kind).toBe('asleep');
    expect(sessionAfter(fourth, { type: 'wake-tap', now: 24 * H }).state.kind).toBe('awake');
  });

  it('counts the stored starts only: a start leaves the window 24 h after it', () => {
    const second = session(session(FIRST, 0, { minutes: 5, perDay: 2 }), 6 * H, { minutes: 5, perDay: 2 });

    expect(second).toEqual({ kind: 'asleep', until: 24 * H, starts: [0, 6 * H] });
    expect(sessionAfter(second, { type: 'wake-tap', now: 24 * H - 1 }).state.kind).toBe('asleep');
    expect(session(sessionAfter(second, { type: 'wake-tap', now: 24 * H }).state, 24 * H, TEN)).toMatchObject({
      starts: [6 * H, 24 * H],
    });
  });

  it('never counts a session with 0 used as a start', () => {
    const two = { minutes: 5, perDay: 2 } as const;
    const empty = run(session(FIRST, 0, two), [
      { type: 'wake-tap', now: 6 * H },
      { type: 'list-open', now: 6 * H, settings: two },
      { type: 'hide', now: 6 * H },
      { type: 'show', now: 12 * H },
    ]).state;
    expect(empty).toEqual({ kind: 'awake', starts: [0], byParent: false });

    expect(untilOf(session(empty, 12 * H, two))).toBe(24 * H);
  });

  it('keeps a session after "Open a new session now" out of the cap, but its start gives the spacing', () => {
    const first = session(FIRST, 0);
    const byParent = session(sessionAfter(first, { type: 'open-now', now: H }).state, H);
    expect(byParent).toEqual({ kind: 'asleep', until: 4 * H, starts: [0] });

    const fourth = [4 * H, 7 * H, 10 * H].reduce<SessionState>((state, at) => session(state, at), byParent);
    expect(untilOf(fourth)).toBe(24 * H);
  });

  it('with a lower setting of sessions per day than the stored starts, sleeps until the start that must leave + 24 h', () => {
    const six = { minutes: 5, perDay: 6 } as const;
    const five = [0, 2 * H, 4 * H, 6 * H, 8 * H].reduce<SessionState>((state, at) => session(state, at, six), FIRST);

    expect(untilOf(session(five, 10 * H, { minutes: 5, perDay: 2 }))).toBe(32 * H);
  });

  it('keeps the settings of the open session when the settings change', () => {
    const changed = run(opened(0, TEN), [
      ...ticks(0, 100 * S),
      { type: 'list-open', now: 100 * S, settings: { minutes: 5, perDay: 1 } },
    ]);
    expect(changed.state).toMatchObject({ shownStage: 'day' });

    expect(untilOf(sessionAfter(changed.state, { type: 'goodbye', now: 100 * S }).state)).toBe(3 * H);
  });
});

describe('the wake-up', () => {
  const asleep = session(FIRST, 0);

  it('ignores a wake tap before the end of the rest time, and wakes the pals after it', () => {
    expect(restOver(asleep, 3 * H - 1)).toBe(false);
    expect(sessionAfter(asleep, { type: 'wake-tap', now: 3 * H - 1 }).state).toBe(asleep);

    expect(restOver(asleep, 3 * H)).toBe(true);
    expect(sessionAfter(asleep, { type: 'wake-tap', now: 3 * H }).state).toEqual({
      kind: 'awake',
      starts: [0],
      byParent: false,
    });
  });

  it('wakes the pals at "Open a new session now", also with the rolling cap reached', () => {
    const fourth = [0, 3 * H, 6 * H, 9 * H].reduce<SessionState>((state, at) => session(state, at), FIRST);

    expect(sessionAfter(fourth, { type: 'open-now', now: 10 * H }).state).toEqual({
      kind: 'awake',
      starts: [0, 3 * H, 6 * H, 9 * H],
      byParent: true,
    });
  });

  it('changes nothing at "Open a new session now" while a session is open', () => {
    const open = run(opened(0), ticks(0, MIN)).state;

    expect(sessionAfter(open, { type: 'open-now', now: MIN }).state).toEqual(open);
  });
});

describe('the hidden gap', () => {
  const played = run(opened(0), [...ticks(0, MIN), { type: 'hide', now: MIN }]).state;

  it('ends the session when it reaches the asleep-until of a goodbye at the hide, with the rest time over', () => {
    const shown = sessionAfter(played, { type: 'show', now: 5 * H }).state;

    expect(shown).toEqual({ kind: 'asleep', until: 3 * H, starts: [0] });
    expect(restOver(shown, 5 * H)).toBe(true);
  });

  it('keeps the session open after a shorter gap, and does not count the gap', () => {
    const shown = sessionAfter(played, { type: 'show', now: 3 * H - 1 }).state;

    expect(shown).toMatchObject({ kind: 'open', usedMs: MIN, hiddenAt: null });
    expect(usedOf(run(shown, [{ type: 'tick', now: 3 * H }]).state)).toBe(MIN);
  });

  it('gives awake after a gap that ends a session with 0 used', () => {
    const empty = run(opened(0), [
      { type: 'hide', now: 0 },
      { type: 'show', now: 3 * H },
    ]).state;

    expect(empty).toEqual({ kind: 'awake', starts: [], byParent: false });
  });

  it('keeps a session after "Open a new session now" out of the cap after a gap that ends it with 0 used', () => {
    const asleep = session(FIRST, 0);
    const awake = sessionAfter(asleep, { type: 'open-now', now: H }).state;
    const empty = run(awake, [
      { type: 'list-open', now: H, settings: TEN },
      { type: 'hide', now: H },
      { type: 'show', now: 5 * H },
    ]).state;

    expect(empty).toEqual({ kind: 'awake', starts: [0], byParent: true });
  });

  it('never ends a session for time on the visible title screen or in the parent area', () => {
    const idle = run(opened(0), [
      ...ticks(0, MIN),
      { type: 'count-stop', now: MIN },
      { type: 'list-open', now: 20 * H, settings: TEN },
    ]);

    expect(idle).toMatchObject({ step: null, state: { kind: 'open', usedMs: MIN, shownStage: 'day' } });
  });
});

/** The state after a write to localStorage and a restore at `now`. */
const reloaded = (state: SessionState, now: number): SessionState =>
  restoreSession(JSON.parse(JSON.stringify(storedSession(state))), now);

describe('the restore of the stored state', () => {
  it('applies the gap rule with the stored time of the hide, after a kill', () => {
    const hidden = run(opened(0), [...ticks(0, MIN), { type: 'hide', now: MIN }]).state;

    expect(reloaded(hidden, 5 * H)).toEqual({ kind: 'asleep', until: 3 * H, starts: [0] });
    expect(reloaded(hidden, 2 * H)).toMatchObject({ kind: 'open', usedMs: MIN, hiddenAt: null });
  });

  it('never counts the gap as play time', () => {
    const counting = run(opened(0), ticks(0, MIN)).state;
    const restored = reloaded(counting, MIN + 30 * S);

    expect(usedOf(run(restored, [{ type: 'tick', now: MIN + 40 * S }]).state)).toBe(MIN);
    expect(
      usedOf(
        run(restored, [
          { type: 'count-start', now: 2 * MIN },
          { type: 'tick', now: 2 * MIN + 15 * S },
        ]).state
      )
    ).toBe(MIN + 15 * S);
  });

  describe('with a record of the last song', () => {
    const six = { minutes: 5, perDay: 6 } as const;
    const lastSong = run(opened(0, six), [
      ...ticks(0, 15 * S),
      { type: 'list-open', now: 15 * S, settings: six },
      { type: 'count-stop', now: 15 * S },
      { type: 'song-start', now: 3 * H },
    ]);

    it('gives the asleep state, so a reload never gives one more song', () => {
      expect(lastSong.last).toBe(true);
      expect(reloaded(lastSong.state, 3 * H + 100 * S)).toEqual({
        kind: 'asleep',
        until: 3 * H + 100 * S,
        starts: [0],
      });
    });

    it('takes the start of the last song plus L as the goodbye time, when that is earlier than the restore', () => {
      expect(SONG_ALLOWANCE_MS).toBe(300 * S);
      expect(untilOf(reloaded(lastSong.state, 5 * H))).toBe(3 * H + SONG_ALLOWANCE_MS);
    });

    it('loses the record after a failed load, so the session stays open', () => {
      const failed = sessionAfter(lastSong.state, { type: 'load-failed', now: 3 * H + 2 * S }).state;

      expect(reloaded(failed, 3 * H + 100 * S)).toMatchObject({ kind: 'open', lastSongAt: null });
    });
  });

  it('keeps the shown stage, which never goes back inside a session', () => {
    const stored = { ...storedSession(run(opened(0), ticks(0, MIN)).state), shownStage: 'sunset' };
    const answer = sessionAfter(restoreSession(stored, MIN), { type: 'list-open', now: MIN, settings: TEN });

    expect(answer).toMatchObject({ step: null, state: { shownStage: 'sunset' } });
  });

  it('cuts an asleep-until more than 24 h ahead to now + 24 h, and counts a start later than now as now', () => {
    const stored = storedSession({ kind: 'asleep', until: 40 * H, starts: [-2 * H, 5 * H] });

    expect(restoreSession(stored, 0)).toEqual({ kind: 'asleep', until: 24 * H, starts: [-2 * H, 0] });
  });

  it('gives the awake state for a damaged or old state, and never throws', () => {
    const open = storedSession(run(opened(0), ticks(0, MIN)).state);
    const damaged: unknown[] = [
      undefined,
      null,
      'open',
      42,
      [],
      {},
      { ...open, version: 0 },
      { ...open, kind: 'closed' },
      { ...open, usedMs: '60000' },
      { ...open, settings: { minutes: 7, perDay: 4 } },
      { ...open, shownStage: 'night' },
      { ...open, starts: [0, 'x'] },
      { ...open, starts: null },
      { ...open, startedAt: Number.NaN },
      { version: 1, kind: 'asleep', until: null, starts: [] },
      { version: 1, kind: 'awake', starts: [], byParent: 'yes' },
    ];

    for (const stored of damaged) {
      expect(restoreSession(stored, MIN)).toEqual({ kind: 'awake', starts: [], byParent: false });
    }
  });
});

describe('the restore of the stored settings', () => {
  it('keeps valid settings through the JSON of localStorage', () => {
    const settings: SessionSettings = { minutes: 25, perDay: 2 };

    expect(restoreSessionSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  });

  it('gives the default of 10 minutes and 4 sessions per day for no settings or damaged settings', () => {
    expect(DEFAULT_SESSION_SETTINGS).toEqual({ minutes: 10, perDay: 4 });
    for (const stored of [undefined, null, 'ten', [], {}, { minutes: 12, perDay: 0 }, { minutes: '5', perDay: '2' }]) {
      expect(restoreSessionSettings(stored)).toEqual(DEFAULT_SESSION_SETTINGS);
    }
  });

  it('gives the default only for the damaged field', () => {
    expect(restoreSessionSettings({ minutes: 5, perDay: 9 })).toEqual({ minutes: 5, perDay: 4 });
  });
});

describe('the status line of the parent area', () => {
  it('gives the minutes used and the limit of an open session', () => {
    expect(parentStatus(run(opened(0), ticks(0, 6 * MIN + 30 * S)).state, 6 * MIN + 30 * S)).toEqual({
      kind: 'open',
      usedMinutes: 6,
      limitMinutes: 10,
    });
  });

  it('gives the minutes that the pals still sleep, and rest-over after the rest time', () => {
    const asleep = session(FIRST, 0);

    expect(parentStatus(asleep, H + 40 * MIN)).toEqual({ kind: 'asleep', minutesLeft: 80 });
    expect(parentStatus(asleep, H + 40 * MIN - 30 * S)).toEqual({ kind: 'asleep', minutesLeft: 81 });
    expect(parentStatus(asleep, 3 * H)).toEqual({ kind: 'rest-over' });
  });

  it('gives awake while no session is open', () => {
    expect(parentStatus(FIRST, 0)).toEqual({ kind: 'awake' });
  });
});
