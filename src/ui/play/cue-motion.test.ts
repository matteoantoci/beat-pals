import { describe, expect, it } from 'vitest';
import { CUE_PALS, CUE_SOUNDS, cueRing, hopKeys, RAY_PULSE, type Key } from './cue-motion';

// The timing of the last-song cue (play-sessions spec, "Screens and motion").

/** The times where a pulse starts: a key that the next key goes above. */
const pulseStarts = (keys: readonly Key[]): readonly number[] =>
  keys.flatMap(([at, value], k) => {
    const next = keys[k + 1];
    return next && next[1] > value ? [at] : [];
  });

describe('the last-song cue', () => {
  it('plays the tune at 0.45 s', () => {
    expect(CUE_SOUNDS).toEqual([{ effect: 'last-song', at: 0.45 }]);
  });

  it('pulses the rays on the 4 notes of the tune', () => {
    expect(pulseStarts(RAY_PULSE)).toEqual([0.45, 0.75, 1.05, 1.35]);
  });

  it('fills the ring with the time out of 3.2 s', () => {
    expect(cueRing(0, 1)).toBe(0);
    expect(cueRing(1.6, 1)).toBe(0.5);
    expect(cueRing(3.2, 1)).toBe(1);
    expect(cueRing(5, 1)).toBe(1);
  });

  it('fills the ring no further than the load fill, so the ring waits for a slow load', () => {
    expect(cueRing(3.2, 0.3)).toBe(0.3);
    expect(cueRing(6, 0.85)).toBe(0.85);
  });

  it('lets each pal hop 3 times and stand on the hill again before the song can start at 3.2 s', () => {
    for (const { delay } of CUE_PALS) {
      const keys = hopKeys(delay);
      expect(keys.filter(([, y]) => y < 0)).toHaveLength(3);
      const last = keys.at(-1);
      expect(last?.[1]).toBe(0);
      expect(last?.[0]).toBeLessThan(3.2);
    }
  });
});
