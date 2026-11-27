import { describe, expect, it } from 'vitest';
import { playDayOf } from './play-day';

// The local calendar of the test is the calendar of Rome: CET (UTC+1) in winter, CEST (UTC+2) in summer. The expected
// times are UTC times, so they do not use the calendar that the function uses.
process.env['TZ'] = 'Europe/Rome';

const utc = (iso: string): number => Date.parse(iso);
const H = 3_600_000;
const STOP_20 = 1200;

describe('playDayOf', () => {
  it('gives the day start at 5:00, the stop time, and the next day start of a normal day', () => {
    expect(playDayOf(utc('2026-11-27T13:00:00Z'), STOP_20)).toEqual({
      start: utc('2026-11-27T04:00:00Z'),
      stop: utc('2026-11-27T19:00:00Z'),
      next: utc('2026-11-28T04:00:00Z'),
    });
  });

  it('gives the stop time of the settings', () => {
    expect(playDayOf(utc('2026-11-27T13:00:00Z'), 1080).stop).toBe(utc('2026-11-27T17:00:00Z'));
    expect(playDayOf(utc('2026-11-27T13:00:00Z'), 1260).stop).toBe(utc('2026-11-27T20:00:00Z'));
  });

  it('starts a play day at 5:00 exactly', () => {
    expect(playDayOf(utc('2026-11-28T04:00:00Z'), STOP_20).start).toBe(utc('2026-11-28T04:00:00Z'));
  });

  it('gives the play day before from 0:00 to 5:00, so its stop time is past', () => {
    const night = {
      start: utc('2026-11-27T04:00:00Z'),
      stop: utc('2026-11-27T19:00:00Z'),
      next: utc('2026-11-28T04:00:00Z'),
    };

    expect(playDayOf(utc('2026-11-27T23:00:00Z'), STOP_20)).toEqual(night);
    expect(playDayOf(utc('2026-11-28T02:00:00Z'), STOP_20)).toEqual(night);
    expect(playDayOf(utc('2026-11-28T04:00:00Z') - 1, STOP_20)).toEqual(night);
  });

  it('gives a play day of 23 h on the night when the clocks go forward (29 March 2026)', () => {
    const day = playDayOf(utc('2026-03-28T12:00:00Z'), STOP_20);

    expect(day).toEqual({
      start: utc('2026-03-28T04:00:00Z'),
      stop: utc('2026-03-28T19:00:00Z'),
      next: utc('2026-03-29T03:00:00Z'),
    });
    expect(day.next - day.start).toBe(23 * H);
    expect(playDayOf(utc('2026-03-29T02:30:00Z'), STOP_20).start).toBe(utc('2026-03-28T04:00:00Z'));
    expect(playDayOf(utc('2026-03-29T12:00:00Z'), STOP_20)).toEqual({
      start: utc('2026-03-29T03:00:00Z'),
      stop: utc('2026-03-29T18:00:00Z'),
      next: utc('2026-03-30T03:00:00Z'),
    });
  });

  it('gives a play day of 25 h on the night when the clocks go back (25 October 2026)', () => {
    const day = playDayOf(utc('2026-10-24T12:00:00Z'), STOP_20);

    expect(day).toEqual({
      start: utc('2026-10-24T03:00:00Z'),
      stop: utc('2026-10-24T18:00:00Z'),
      next: utc('2026-10-25T04:00:00Z'),
    });
    expect(day.next - day.start).toBe(25 * H);
    expect(playDayOf(utc('2026-10-25T03:30:00Z'), STOP_20).start).toBe(utc('2026-10-24T03:00:00Z'));
    expect(playDayOf(utc('2026-10-25T12:00:00Z'), STOP_20).stop).toBe(utc('2026-10-25T19:00:00Z'));
  });
});
