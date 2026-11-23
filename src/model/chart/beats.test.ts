import { describe, expect, it } from 'vitest';
import { factsOf } from './fixtures/facts-of';
import noTempo from './fixtures/no-tempo.chart?raw';
import tempoChange from './fixtures/tempo-change.chart?raw';
import timeSignatures from './fixtures/time-signatures.chart?raw';

/** The beat times, and the times of the downbeats. */
const beatsOf = (text: string) => {
  const { beats } = factsOf(text);
  return { all: beats.map((beat) => beat.t), downbeats: beats.filter((beat) => beat.downbeat).map((beat) => beat.t) };
};

describe('readChart beats', () => {
  it('gives the beats of the time signature over the tempo map, to the end of the last bar', () => {
    expect(beatsOf(tempoChange)).toEqual({ all: [0, 0.5, 1, 1.5, 2, 3, 4, 5], downbeats: [0, 2] });
  });

  it('gives a beat on each quarter note in 4/4 when the chart has no time signature', () => {
    expect(beatsOf(noTempo)).toEqual({ all: [0, 0.5, 1, 2], downbeats: [0] });
  });

  it('starts a new bar at each time signature and uses its beat length', () => {
    expect(beatsOf(timeSignatures)).toEqual({
      all: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.25, 3.5, 3.75, 4, 4.25],
      downbeats: [0, 1.5, 3],
    });
  });
});
