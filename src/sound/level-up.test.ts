import { describe, expect, it } from 'vitest';
import { levelUpTones } from './level-up';

/** The pitches in the order they start. */
const pitches = (step: Parameters<typeof levelUpTones>[0]): number[] =>
  levelUpTones(step)
    .toSorted((a, b) => a.at - b.at || a.hz - b.hz)
    .map((tone) => Math.round(tone.hz));

describe('the level-up sounds', () => {
  it('rise from G5, A5, and B5 for steps 1 to 3', () => {
    expect(pitches(1)[0]).toBe(784);
    expect(pitches(2)[0]).toBe(880);
    expect(pitches(3)[0]).toBe(988);
    for (const step of [1, 2, 3] as const) {
      const notes = pitches(step);
      expect(notes).toStrictEqual(notes.toSorted((a, b) => a - b));
    }
  });

  it('play a G4 pickup and then a C major chord at gold', () => {
    const [pickup, ...chord] = levelUpTones('gold').toSorted((a, b) => a.at - b.at);
    expect(Math.round(pickup?.hz ?? 0)).toBe(392);
    const chordStart = chord[0]?.at ?? 0;
    expect(chordStart).toBeGreaterThan(pickup?.at ?? 0);
    const together = chord.filter((tone) => tone.at === chordStart).map((tone) => Math.round(tone.hz));
    expect(together).toStrictEqual([523, 659, 784, 1047]);
  });
});
