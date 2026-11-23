import { describe, expect, it } from 'vitest';
import { firstSongTime, songTime, startAt } from './index';
import type { ClockReading, SongStart } from './index';

/** A reading of a running context whose output timestamp is `age` ms old. */
const running = (contextTime: number, age = 0): ClockReading => ({
  running: true,
  contextTime,
  performanceTime: 1000,
  now: 1000 + age,
});

describe('firstSongTime', () => {
  it('starts at song time 0 when the first note is 2 s or more into the song', () => {
    expect(firstSongTime(2)).toBe(0);
    expect(firstSongTime(7.5)).toBe(0);
  });

  it('starts before the audio when the first note is early, so the note enters at the top', () => {
    expect(firstSongTime(0.5)).toBe(-1.5);
  });

  it('adds a negative first note time from the delay to the lead-in', () => {
    expect(firstSongTime(-0.25)).toBe(-2.25);
  });
});

/** Checks each field of a start to the float precision. */
const expectStart = (actual: SongStart, expected: SongStart): void => {
  expect(actual.t0).toBeCloseTo(expected.t0);
  expect(actual.when).toBeCloseTo(expected.when);
  expect(actual.offset).toBeCloseTo(expected.offset);
};

describe('startAt', () => {
  it('starts the song 0.1 s after the current context time', () => {
    expectStart(startAt(10, 0), { t0: 10.1, when: 10.1, offset: 0 });
  });

  it('delays the audio by the lead-in', () => {
    expectStart(startAt(10, -1.5), { t0: 11.6, when: 11.6, offset: 0 });
  });

  it('resumes at the saved offset in a new context: t0 is the start minus the offset', () => {
    expectStart(startAt(0.5, 42), { t0: -41.4, when: 0.6, offset: 42 });
  });

  it('resumes inside the lead-in with the rest of the delay before the audio', () => {
    expectStart(startAt(3, -0.75), { t0: 3.85, when: 3.85, offset: 0 });
  });
});

describe('songTime', () => {
  const clock = { t0: 10.1, frozen: -1.5 };

  it('gives the context time minus t0 when no time passed since the output timestamp', () => {
    expect(songTime(clock, running(13.6))).toBeCloseTo(3.5);
  });

  it('adds the time since the output timestamp', () => {
    expect(songTime(clock, running(13.6, 20))).toBeCloseTo(3.52);
  });

  it('adds at most 0.05 s after an old output timestamp', () => {
    expect(songTime(clock, running(13.6, 400))).toBeCloseTo(3.55);
  });

  it('adds nothing for an output timestamp that is ahead of the page clock', () => {
    expect(songTime(clock, running(13.6, -30))).toBeCloseTo(3.5);
  });

  it('gives the frozen time when the context does not run', () => {
    expect(songTime(clock, { ...running(13.6), running: false })).toBe(-1.5);
  });

  it('gives the frozen time before the first output timestamp', () => {
    expect(songTime(clock, { ...running(13.6), performanceTime: 0 })).toBe(-1.5);
  });

  it('gives the pause offset back after a resume in a new context', () => {
    const paused = songTime(clock, running(52.1));
    const resumed = startAt(0.25, paused);

    expect(paused).toBeCloseTo(42);
    expect(songTime({ t0: resumed.t0, frozen: paused }, running(0.35))).toBeCloseTo(42);
    expect(songTime({ t0: resumed.t0, frozen: paused }, running(1.35))).toBeCloseTo(43);
  });
});
