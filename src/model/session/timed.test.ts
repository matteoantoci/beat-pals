import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_SETTINGS, lastStartMinutes, nextChange, sessionAfter } from '../index';
import type { PlayDay, SessionSettings, SessionState, SessionTime } from '../index';

const MIN = 60_000;
const H = 60 * MIN;
const DAY = 24 * H;
const DEF: SessionSettings = DEFAULT_SESSION_SETTINGS;

/** A wall time: the day number, and the hours and minutes of the clock of the test. */
const at = (day: number, hours: number, minutes = 0): number => day * DAY + hours * H + minutes * MIN;

/** The play day of a wall time on the clock of the test: a day start at 5:00 every 24 h. */
const dayOf = (now: number, settings: SessionSettings): PlayDay => {
  const day = Math.floor((now - 5 * H) / DAY);
  return { start: at(day, 5), stop: day * DAY + settings.stopMinutes * MIN, next: at(day + 1, 5) };
};

const timeAt = (now: number, settings: SessionSettings = DEF): SessionTime => ({
  now,
  day: dayOf(now, settings),
  settings,
});

const today = { start: at(0, 5), usedMs: 0 };
const awake: SessionState = { kind: 'awake', today, byParent: false };

describe('the next change by time alone', () => {
  it('ends the rest time at the asleep-until, with the same state', () => {
    const asleep: SessionState = { kind: 'asleep', until: at(0, 11), today };
    expect(nextChange(asleep, timeAt(at(0, 10)))).toEqual({ at: at(0, 11), state: asleep });
    expect(nextChange(asleep, timeAt(at(0, 11)))).toBeNull();
  });

  it('ends the last start time 1 ms after it, and then the pals sleep until the next day start', () => {
    const change = nextChange(awake, timeAt(at(0, 10)));
    expect(change).toEqual({ at: at(0, 19, 45) + 1, state: { kind: 'asleep', until: at(1, 5), today } });
    const before = { type: 'title-show', ...timeAt(at(0, 19, 45)) } as const;
    expect(sessionAfter(awake, before).state).toBe(awake);
    expect(nextChange(awake, timeAt(at(0, 19, 45) + 1))).toBeNull();
  });

  it('takes the last start time from the current settings', () => {
    const settings: SessionSettings = { ...DEF, minutes: 30, stopMinutes: 1140 };
    expect(nextChange(awake, timeAt(at(0, 10), settings))?.at).toBe(at(0, 18, 30) + 1);
  });

  it('has no change for a session of the parent, nor for an open session', () => {
    expect(nextChange({ ...awake, byParent: true }, timeAt(at(0, 10)))).toBeNull();
    const open = sessionAfter(awake, { type: 'list-open', ...timeAt(at(0, 10)) }).state;
    expect(open.kind).toBe('open');
    expect(nextChange(open, timeAt(at(0, 10)))).toBeNull();
  });
});

describe('the last start time as a clock time', () => {
  it('is the stop time minus the minutes of a session', () => {
    expect(lastStartMinutes(DEF)).toBe(1185);
    expect(lastStartMinutes({ ...DEF, minutes: 30, stopMinutes: 1080 })).toBe(1050);
  });
});
