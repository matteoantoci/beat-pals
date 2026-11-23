import { describe, expect, it } from 'vitest';
import { danceOf, NEW_SONG, playSetup, scorePlay } from '../index';
import type { SongProgress } from '../index';

const GOOD = 0.7;
const WEAK = 0.69;

/** The progress after the plays, one hit ratio each, from a new song. */
const after = (ratios: readonly number[], from: SongProgress = NEW_SONG): SongProgress =>
  ratios.reduce((progress, ratio) => scorePlay(progress, ratio).after, from);

describe('playSetup', () => {
  it('starts a new song at bronze, at the first speed step', () => {
    expect(playSetup(NEW_SONG)).toEqual({ color: 'bronze', step: 0, steppedDown: false });
  });

  it('plays the speed step of the stars of the color', () => {
    expect(playSetup({ color: 1, stars: 1, weakPlays: 0 })).toEqual({ color: 'silver', step: 1, steppedDown: false });
    expect(playSetup({ color: 3, stars: 2, weakPlays: 1 })).toEqual({ color: 'platinum', step: 2, steppedDown: false });
  });

  it('keeps diamond with 3 stars at the last speed step', () => {
    expect(playSetup({ color: 4, stars: 3, weakPlays: 0 })).toEqual({ color: 'diamond', step: 2, steppedDown: false });
  });

  it('steps down one speed step after 2 weak plays', () => {
    expect(playSetup({ color: 2, stars: 2, weakPlays: 2 })).toEqual({ color: 'gold', step: 1, steppedDown: true });
    expect(playSetup({ color: 4, stars: 3, weakPlays: 2 })).toEqual({ color: 'diamond', step: 1, steppedDown: true });
  });

  it('does not step down at the first speed step of a color', () => {
    expect(playSetup({ color: 1, stars: 0, weakPlays: 2 })).toEqual({ color: 'silver', step: 0, steppedDown: false });
  });
});

describe('scorePlay', () => {
  it('earns the next star at 70%', () => {
    const score = scorePlay(NEW_SONG, GOOD);

    expect(score.after).toEqual({ color: 0, stars: 1, weakPlays: 0 });
    expect(score.star).toBe(0);
    expect(score.opened).toBeNull();
  });

  it('earns nothing below 70% and takes nothing away', () => {
    const score = scorePlay({ color: 1, stars: 2, weakPlays: 0 }, WEAK);

    expect(score.after).toEqual({ color: 1, stars: 2, weakPlays: 1 });
    expect(score.star).toBeNull();
  });

  it('opens the next color with 0 stars at the third star', () => {
    const score = scorePlay({ color: 0, stars: 2, weakPlays: 0 }, 1);

    expect(score.after).toEqual({ color: 1, stars: 0, weakPlays: 0 });
    expect(score.star).toBe(2);
    expect(score.opened).toBe('silver');
  });

  it('brings a pal into the band at silver and at gold only', () => {
    expect(scorePlay({ color: 0, stars: 2, weakPlays: 0 }, 1).joins).toBe(0);
    expect(scorePlay({ color: 1, stars: 2, weakPlays: 0 }, 1).joins).toBe(2);
    expect(scorePlay({ color: 2, stars: 2, weakPlays: 0 }, 1).joins).toBeNull();
    expect(scorePlay({ color: 3, stars: 2, weakPlays: 0 }, 1).joins).toBeNull();
    expect(scorePlay({ color: 0, stars: 1, weakPlays: 0 }, 1).joins).toBeNull();
  });

  it('reaches diamond with 3 stars in 15 good plays, and stays there', () => {
    const top = after(Array.from({ length: 15 }, () => 1));

    expect(top).toEqual({ color: 4, stars: 3, weakPlays: 0 });
    expect(scorePlay(top, 1).after).toEqual(top);
    expect(scorePlay(top, 1).star).toBeNull();
    expect(scorePlay(top, 1).opened).toBeNull();
  });

  it('counts weak plays up to 2', () => {
    expect(after([WEAK])).toEqual({ color: 0, stars: 0, weakPlays: 1 });
    expect(after([WEAK, WEAK, WEAK, WEAK])).toEqual({ color: 0, stars: 0, weakPlays: 2 });
  });

  it('sets weak plays to 0 after a good play', () => {
    expect(after([WEAK, GOOD])).toEqual({ color: 0, stars: 1, weakPlays: 0 });
  });

  it('gives no star for a good play at the lower speed step, and the next play returns to the earned step', () => {
    const tired = after([WEAK, WEAK], { color: 2, stars: 1, weakPlays: 0 });
    expect(playSetup(tired)).toMatchObject({ step: 0, steppedDown: true });

    const score = scorePlay(tired, GOOD);

    expect(score.after).toEqual({ color: 2, stars: 1, weakPlays: 0 });
    expect(score.star).toBeNull();
    expect(playSetup(score.after)).toMatchObject({ step: 1, steppedDown: false });
  });

  it('keeps the lower speed step after a weak play at it, and never goes down 2 steps', () => {
    const tired = after([WEAK, WEAK, WEAK, WEAK], { color: 3, stars: 2, weakPlays: 0 });

    expect(tired).toEqual({ color: 3, stars: 2, weakPlays: 2 });
    expect(playSetup(tired)).toMatchObject({ step: 1, steppedDown: true });
  });

  it('earns a star at the first step of a color after weak plays, because that play is not stepped down', () => {
    const score = scorePlay({ color: 1, stars: 0, weakPlays: 2 }, GOOD);

    expect(score.after).toEqual({ color: 1, stars: 1, weakPlays: 0 });
    expect(score.star).toBe(0);
  });
});

describe('danceOf', () => {
  it('makes the band dance below 40%, with no sad pal', () => {
    expect(danceOf(0)).toBe('band');
    expect(danceOf(0.39)).toBe('band');
  });

  it('makes the band and the waiting pals dance from 40% to below 70%', () => {
    expect(danceOf(0.4)).toBe('band-and-waiting');
    expect(danceOf(0.69)).toBe('band-and-waiting');
  });

  it('makes all pals dance with confetti from 70%', () => {
    expect(danceOf(0.7)).toBe('party');
    expect(danceOf(1)).toBe('party');
  });
});
