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

describe('statusLine', () => {
  it('gives each state with time spans only', () => {
    expect(statusLine({ kind: 'awake' })).toBe('The pals are awake. A session starts when the song list opens.');
    expect(statusLine({ kind: 'open', usedMinutes: 6, limitMinutes: 10 })).toBe('6 of 10 minutes used');
    expect(statusLine({ kind: 'asleep', minutesLeft: 80 })).toBe('Asleep for 1 h 20 min more');
    expect(statusLine({ kind: 'rest-over' })).toBe('The pals wake at the next tap');
  });

  it('never gives a clock time', () => {
    const lines = [
      statusLine({ kind: 'asleep', minutesLeft: 719 }),
      statusLine({ kind: 'open', usedMinutes: 12, limitMinutes: 30 }),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/\d:\d/);
    }
  });
});

describe('planLine', () => {
  it('gives the spacing and the daily total of the defaults', () => {
    expect(planLine({ minutes: 10, perDay: 4 })).toBe('A new session about every 3 h, at most 40 minutes a day.');
  });

  it('follows the settings', () => {
    expect(planLine({ minutes: 30, perDay: 1 })).toBe('A new session about every 12 h, at most 30 minutes a day.');
    expect(planLine({ minutes: 5, perDay: 5 })).toBe('A new session about every 2 h 24 min, at most 25 minutes a day.');
  });
});
