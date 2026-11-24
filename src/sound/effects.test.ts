import { describe, expect, it } from 'vitest';
import { EFFECT_FILES, levelUpShot, starMomentShot } from './effects';

// The paths below public/, as the engine fetches them. Without `eager`, Vite only lists the files.
const shipped = new Set(Object.keys(import.meta.glob('/public/sounds/*')).map((path) => path.slice('/public/'.length)));

describe('the sound effects', () => {
  it('each have a file in public/sounds/', () => {
    expect(EFFECT_FILES).toHaveLength(8);
    expect(EFFECT_FILES.filter((file) => !shipped.has(file))).toEqual([]);
  });

  it('play the level-up chime one whole tone higher for each step, and the bells at gold', () => {
    const tone = 2 ** (2 / 12);
    expect(levelUpShot(1)).toEqual({ effect: 'level-up', rate: 1 });
    expect(levelUpShot(2).rate).toBeCloseTo(tone);
    expect(levelUpShot(3).rate).toBeCloseTo(tone * tone);
    expect(levelUpShot('gold')).toEqual({ effect: 'gold', rate: 1 });
  });

  it('play the star moment up to 1 semitone higher or lower, and up to 1.5 dB louder or softer', () => {
    const semitone = 2 ** (1 / 12);
    expect(starMomentShot(() => 0.5)).toEqual({ effect: 'star-moment', rate: 1, gainDb: 0 });
    const low = starMomentShot(() => 0);
    expect(low.rate).toBeCloseTo(1 / semitone);
    expect(low.gainDb).toBeCloseTo(-1.5);
    const high = starMomentShot(() => 1);
    expect(high.rate).toBeCloseTo(semitone);
    expect(high.gainDb).toBeCloseTo(1.5);
  });
});
