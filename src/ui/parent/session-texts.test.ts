import { describe, expect, it } from 'vitest';
import { planLine, spanText, statusLine } from './session-texts';

describe('spanText', () => {
  it('gives minutes, hours, or both', () => {
    expect(spanText(1)).toBe('1 min');
    expect(spanText(45)).toBe('45 min');
    expect(spanText(60)).toBe('1 h');
    expect(spanText(80)).toBe('1 h 20 min');
    expect(spanText(144)).toBe('2 h 24 min');
  });
});

/** The facts of an open session that the parent did not open, with 20 of 45 minutes used today. */
const open = (usedMinutes: number, limitMinutes: number) =>
  ({ kind: 'open', usedTodayMinutes: 20, dayMinutes: 45, byParent: false, usedMinutes, limitMinutes }) as const;

describe('statusLine', () => {
  it('gives each state with time spans only', () => {
    expect(statusLine({ kind: 'awake', usedTodayMinutes: 20, dayMinutes: 45, byParent: false })).toBe(
      'The pals are awake. A session starts when the song list opens.'
    );
    expect(statusLine(open(6, 10))).toBe('6 of 10 minutes used');
    expect(statusLine({ kind: 'asleep', minutesLeft: 80, untilDayStart: false })).toBe('Asleep for 1 h 20 min more');
    expect(statusLine({ kind: 'rest-time-over' })).toBe('The pals wake at the next tap');
  });

  it('never gives a clock time', () => {
    const lines = [statusLine({ kind: 'asleep', minutesLeft: 719, untilDayStart: false }), statusLine(open(12, 30))];
    for (const line of lines) {
      expect(line).not.toMatch(/\d:\d/);
    }
  });
});

describe('planLine', () => {
  it('gives the day budget and the minutes of a session of the defaults', () => {
    expect(planLine({ minutes: 15, dayMinutes: 45, restMinutes: 60, stopMinutes: 1200 })).toBe(
      'Up to 45 minutes a day, in sessions of up to 15 minutes.'
    );
  });

  it('follows the settings', () => {
    expect(planLine({ minutes: 30, dayMinutes: 90, restMinutes: 120, stopMinutes: 1080 })).toBe(
      'Up to 90 minutes a day, in sessions of up to 30 minutes.'
    );
  });
});
