import { describe, expect, it } from 'vitest';
import { result, startPlay } from '../index';
import { playActions, playOut } from './test-player';
import type { ChildChart, PlayEvent } from '../index';

/** A chart of 3 notes, 2 s apart from 2 s on: a double on Pip + Dot, a soft hold of 1 s on Bo, a plain note on Dot. */
const CHART: ChildChart = {
  band: [0, 1, 2],
  notes: [
    { t: 2, lanes: [0, 1], holdSec: 0 },
    { t: 4, lanes: [2], holdSec: 1 },
    { t: 6, lanes: [1], holdSec: 0 },
  ],
};

const lines = (events: readonly PlayEvent[]): string[] =>
  events.flatMap((event) =>
    event.type === 'energy' ? [] : [`${event.type} ${'lane' in event ? event.lane : event.note}`]
  );

describe('apply: doubles', () => {
  it.each([0, 1] as const)('counts a double as one note when lane %i is tapped', (lane) => {
    const played = playOut(CHART, { lane: (note) => (note === 0 ? lane : (CHART.notes[note]?.lanes[0] ?? 1)) });
    expect(lines(played.events)).toEqual([`hit ${lane}`, 'hit 2', 'holdDone 1', 'hit 1']);
    expect(result(played.end)).toBe(1);
  });

  it('does not count a double tapped in a lane outside it', () => {
    const played = playOut(CHART, { lane: (note) => (note === 0 ? 2 : (CHART.notes[note]?.lanes[0] ?? 1)) });
    expect(lines(played.events)).toEqual(['faded 0', 'hit 2', 'holdDone 1', 'hit 1']);
  });
});

describe('apply: soft holds', () => {
  it.each([
    [1, true],
    [0.5, true],
    [0.4, false],
    [0, false],
  ])('with a hold fraction of %f, gives holdDone: %s, and counts the hold at its tap', (share, done) => {
    const played = playOut(CHART, { hold: () => share });
    expect(lines(played.events)).toEqual(['hit 0', 'hit 2', ...(done ? ['holdDone 1'] : []), 'hit 1']);
    expect(result(played.end)).toBe(1);
  });

  it('never makes an early release a miss', () => {
    const played = playOut(CHART, { hold: () => 0 });
    expect(lines(played.events).some((line) => line.startsWith('faded'))).toBe(false);
  });

  it('gives no holdDone for a hold that was not hit', () => {
    const played = playOut(CHART, { offset: (note) => (note === 1 ? null : 0) });
    expect(lines(played.events)).toEqual(['hit 0', 'faded 1', 'hit 1']);
  });

  it('finishes a hold at its release after the half point, with no advance before the release', () => {
    const played = playActions(startPlay(CHART), [
      { type: 'press', t: 4, lane: 2, pointerId: 7 },
      { type: 'release', t: 4.6, pointerId: 7 },
    ]);
    expect(lines(played.events)).toEqual(['hit 2', 'holdDone 1']);
  });

  it('gives no holdDone for a release before the half point', () => {
    const played = playActions(startPlay(CHART), [
      { type: 'press', t: 4, lane: 2, pointerId: 7 },
      { type: 'release', t: 4.4, pointerId: 7 },
    ]);
    expect(lines(played.events)).toEqual(['hit 2']);
  });
});
