import { describe, expect, it } from 'vitest';
import { clockText, planLine, spanText, statusLine } from './session-texts';

describe('spanText', () => {
  it('gives minutes, hours, or both', () => {
    expect(spanText(1)).toBe('1 min');
    expect(spanText(45)).toBe('45 min');
    expect(spanText(60)).toBe('1 h');
    expect(spanText(80)).toBe('1 h 20 min');
    expect(spanText(144)).toBe('2 h 24 min');
  });
});

describe('clockText', () => {
  it('gives a clock time of minutes after midnight', () => {
    expect(clockText(300)).toBe('5:00');
    expect(clockText(1185)).toBe('19:45');
    expect(clockText(1050)).toBe('17:30');
  });
});

/** The facts of an open session, with 20 of 45 minutes used today. */
const open = (usedMinutes: number, limitMinutes: number, byParent = false) =>
  ({ kind: 'open', usedTodayMinutes: 20, dayMinutes: 45, byParent, usedMinutes, limitMinutes }) as const;

describe('statusLine', () => {
  it('gives the minutes used today and in the session for an open session', () => {
    expect(statusLine(open(6, 15))).toBe('20 of 45 minutes used today · 6 of 15 in this session');
  });

  it('marks a session that the parent opened, which does not use the day budget', () => {
    expect(statusLine(open(6, 15, true))).toBe(
      '20 of 45 minutes used today · 6 of 15 in this session, which you opened'
    );
  });

  it('gives the minutes used today while the pals are awake', () => {
    expect(statusLine({ kind: 'awake', usedTodayMinutes: 20, dayMinutes: 45, byParent: false })).toBe(
      '20 of 45 minutes used today · the pals are awake'
    );
    expect(statusLine({ kind: 'awake', usedTodayMinutes: 45, dayMinutes: 45, byParent: true })).toBe(
      '45 of 45 minutes used today · the pals are awake'
    );
  });

  it('gives the time until the pals wake', () => {
    expect(statusLine({ kind: 'asleep', minutesLeft: 40, untilDayStart: false })).toBe('Asleep for 40 min more');
    expect(statusLine({ kind: 'asleep', minutesLeft: 80, untilDayStart: false })).toBe('Asleep for 1 h 20 min more');
    expect(statusLine({ kind: 'asleep', minutesLeft: 500, untilDayStart: true })).toBe('Asleep until 5:00');
    expect(statusLine({ kind: 'rest-time-over' })).toBe('The pals wake at the next tap');
  });
});

describe('planLine', () => {
  it('gives the day budget, the session, the rest time, and the last start of the defaults', () => {
    expect(planLine({ minutes: 15, dayMinutes: 45, restMinutes: 60, stopMinutes: 1200 })).toBe(
      'Up to 45 minutes a day, in sessions of up to 15 minutes, with at least 1 h between sessions. The last session starts at 19:45.'
    );
  });

  it('follows the settings', () => {
    expect(planLine({ minutes: 30, dayMinutes: 90, restMinutes: 90, stopMinutes: 1080 })).toBe(
      'Up to 90 minutes a day, in sessions of up to 30 minutes, with at least 1 h 30 min between sessions. The last session starts at 17:30.'
    );
  });
});
