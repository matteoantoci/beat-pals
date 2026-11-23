import { describe, expect, it } from 'vitest';
import { readDemo } from './params';

describe('readDemo', () => {
  it('reads the color, the stars, the energy step, the time, and the 2 flags', () => {
    expect(readDemo('?demo=platinum.1&energy=3&t=2.4&sim&reduce')).toEqual({
      ok: true,
      demo: { progress: { color: 3, stars: 1, weakPlays: 0 }, energy: 3, t: 2.4, sim: true, reduce: true },
    });
  });

  it('reads gold as the top energy step', () => {
    const read = readDemo('?demo=diamond.2&energy=gold');
    expect(read.ok && read.demo.energy).toBe('gold');
  });

  it('starts at song time 0 with the energy of the play and no flags when only the record is given', () => {
    expect(readDemo('?demo=bronze.0')).toEqual({
      ok: true,
      demo: { progress: { color: 0, stars: 0, weakPlays: 0 }, energy: undefined, t: 0, sim: false, reduce: false },
    });
  });

  it.each([
    ['no demo value', '?demo'],
    ['an unknown color', '?demo=copper.1'],
    ['no stars', '?demo=gold'],
    ['too many stars', '?demo=gold.4'],
    ['an energy step that does not exist', '?demo=gold.1&energy=5'],
    ['a negative time', '?demo=gold.1&t=-1'],
    ['a time that is not a number', '?demo=gold.1&t=soon'],
  ])('refuses %s', (_, search) => {
    expect(readDemo(search).ok).toBe(false);
  });
});
