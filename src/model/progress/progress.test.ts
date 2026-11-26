import { describe, expect, it } from 'vitest';
import { danceOf, NEW_SONG, playSetup, outcomeOf } from '../index';
import type { SongProgress } from '../index';

const GOOD = 0.8;
const WEAK = 0.79;

/** The progress after the plays, one score each, from a new song. */
const after = (scores: readonly number[], from: SongProgress = NEW_SONG): SongProgress =>
  scores.reduce((progress, score) => outcomeOf(progress, score).after, from);

describe('playSetup', () => {
  it('plays a new song at level 0 (no record), at every beat with rests, and counts rest taps', () => {
    expect(playSetup(NEW_SONG)).toEqual({
      color: 'none',
      step: 2,
      steppedDown: false,
      rests: true,
      emptyTaps: 'second-and-rest',
    });
  });

  it('never steps down at level 0, but after 2 weak plays no empty tap counts there (the escape)', () => {
    const escape = { color: 'none', step: 2, steppedDown: false, rests: true, emptyTaps: 'free' };
    expect(playSetup({ color: 0, stars: 0, weakPlays: 2 })).toEqual(escape);
    expect(playSetup({ color: 0, stars: 0, weakPlays: 1 })).toMatchObject({ emptyTaps: 'second-and-rest' });
  });

  it('plays the speed step of the stars of the color, with no rests and with second taps counted', () => {
    expect(playSetup({ color: 1, stars: 1, weakPlays: 0 })).toEqual({
      color: 'bronze',
      step: 1,
      steppedDown: false,
      rests: false,
      emptyTaps: 'second',
    });
    expect(playSetup({ color: 3, stars: 2, weakPlays: 1 })).toMatchObject({
      color: 'gold',
      step: 2,
      steppedDown: false,
    });
  });

  it('keeps platinum with 3 stars at the last speed step', () => {
    expect(playSetup({ color: 4, stars: 3, weakPlays: 0 })).toMatchObject({ color: 'platinum', step: 2 });
  });

  it('steps down one speed step after 2 weak plays, and still counts second taps', () => {
    expect(playSetup({ color: 2, stars: 2, weakPlays: 2 })).toEqual({
      color: 'silver',
      step: 1,
      steppedDown: true,
      rests: false,
      emptyTaps: 'second',
    });
    expect(playSetup({ color: 4, stars: 3, weakPlays: 2 })).toMatchObject({ step: 1, steppedDown: true });
  });

  it('does not step down at the first speed step of a color', () => {
    expect(playSetup({ color: 1, stars: 0, weakPlays: 2 })).toMatchObject({
      color: 'bronze',
      step: 0,
      steppedDown: false,
    });
  });
});

describe('outcomeOf', () => {
  it('earns the next star at 80%', () => {
    const outcome = outcomeOf({ color: 1, stars: 0, weakPlays: 0 }, GOOD);

    expect(outcome.after).toEqual({ color: 1, stars: 1, weakPlays: 0 });
    expect(outcome.star).toBe(0);
    expect(outcome.opened).toBeNull();
  });

  it('opens bronze with the first good play at level 0, with no star because level 0 has no stars', () => {
    const outcome = outcomeOf(NEW_SONG, GOOD);

    expect(outcome.after).toEqual({ color: 1, stars: 0, weakPlays: 0 });
    expect(outcome.star).toBeNull();
    expect(outcome.opened).toBe('bronze');
    expect(outcome.joins).toBe(0);
  });

  it('earns nothing below 80% and takes nothing away', () => {
    const outcome = outcomeOf({ color: 1, stars: 2, weakPlays: 0 }, WEAK);

    expect(outcome.after).toEqual({ color: 1, stars: 2, weakPlays: 1 });
    expect(outcome.star).toBeNull();
  });

  it('opens the next color with 0 stars at the third star', () => {
    const outcome = outcomeOf({ color: 1, stars: 2, weakPlays: 0 }, 1);

    expect(outcome.after).toEqual({ color: 2, stars: 0, weakPlays: 0 });
    expect(outcome.star).toBe(2);
    expect(outcome.opened).toBe('silver');
  });

  it('brings a pal into the band at bronze and at silver only', () => {
    expect(outcomeOf({ color: 0, stars: 0, weakPlays: 0 }, 1).joins).toBe(0);
    expect(outcomeOf({ color: 1, stars: 2, weakPlays: 0 }, 1).joins).toBe(2);
    expect(outcomeOf({ color: 2, stars: 2, weakPlays: 0 }, 1).joins).toBeNull();
    expect(outcomeOf({ color: 3, stars: 2, weakPlays: 0 }, 1).joins).toBeNull();
    expect(outcomeOf({ color: 1, stars: 1, weakPlays: 0 }, 1).joins).toBeNull();
  });

  it('reaches platinum with 3 stars in 13 good plays, and stays there', () => {
    const top = after(Array.from({ length: 13 }, () => 1));

    expect(top).toEqual({ color: 4, stars: 3, weakPlays: 0 });
    expect(outcomeOf(top, 1).after).toEqual(top);
    expect(outcomeOf(top, 1).star).toBeNull();
    expect(outcomeOf(top, 1).opened).toBeNull();
  });

  it('counts weak plays up to 2', () => {
    expect(after([WEAK])).toEqual({ color: 0, stars: 0, weakPlays: 1 });
    expect(after([WEAK, WEAK, WEAK, WEAK])).toEqual({ color: 0, stars: 0, weakPlays: 2 });
  });

  it('sets weak plays to 0 after a good play', () => {
    expect(after([WEAK, GOOD])).toEqual({ color: 1, stars: 0, weakPlays: 0 });
  });

  it('gives no star for a good play at the lower speed step, and the next play returns to the earned step', () => {
    const tired = after([WEAK, WEAK], { color: 2, stars: 1, weakPlays: 0 });
    expect(playSetup(tired)).toMatchObject({ step: 0, steppedDown: true });

    const outcome = outcomeOf(tired, GOOD);

    expect(outcome.after).toEqual({ color: 2, stars: 1, weakPlays: 0 });
    expect(outcome.star).toBeNull();
    expect(playSetup(outcome.after)).toMatchObject({ step: 1, steppedDown: false });
  });

  it('keeps the lower speed step after a weak play at it, and never goes down 2 steps', () => {
    const tired = after([WEAK, WEAK, WEAK, WEAK], { color: 3, stars: 2, weakPlays: 0 });

    expect(tired).toEqual({ color: 3, stars: 2, weakPlays: 2 });
    expect(playSetup(tired)).toMatchObject({ step: 1, steppedDown: true });
  });

  it('earns a star at the first step of a color after weak plays, because that play is not stepped down', () => {
    const outcome = outcomeOf({ color: 1, stars: 0, weakPlays: 2 }, GOOD);

    expect(outcome.after).toEqual({ color: 1, stars: 1, weakPlays: 0 });
    expect(outcome.star).toBe(0);
  });

  it('opens bronze with a good play at the escape of level 0', () => {
    const escape = after([WEAK, WEAK]);
    expect(playSetup(escape)).toMatchObject({ emptyTaps: 'free' });
    expect(outcomeOf(escape, GOOD)).toMatchObject({ after: { color: 1, stars: 0, weakPlays: 0 }, opened: 'bronze' });
  });
});

describe('danceOf', () => {
  it('makes the band dance below 40%, with no sad pal', () => {
    expect(danceOf(0)).toBe('band');
    expect(danceOf(0.39)).toBe('band');
  });

  it('makes the band and the waiting pals dance from 40% to below 80%', () => {
    expect(danceOf(0.4)).toBe('band-and-waiting');
    expect(danceOf(0.79)).toBe('band-and-waiting');
  });

  it('makes all pals dance with confetti from 80%, as a good play', () => {
    expect(danceOf(0.8)).toBe('party');
    expect(danceOf(1)).toBe('party');
  });
});
