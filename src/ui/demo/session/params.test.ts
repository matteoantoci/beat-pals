import { describe, expect, it } from 'vitest';
import { readSessionDemo } from './params';

// The screen names here are a fixed list of the test. The demo gives the names of its screen registry.
const SCREENS = ['pals', 'night', 'list-day'];

describe('readSessionDemo', () => {
  it('reads the screen, the time, and the 2 flags', () => {
    expect(readSessionDemo('?session=night&t=2.4&sim&reduce', SCREENS)).toEqual({
      ok: true,
      demo: { screen: 'night', t: 2.4, sim: true, reduce: true },
    });
  });

  it('starts at scene time 0 with no flags when only the screen is given', () => {
    expect(readSessionDemo('?session=pals', SCREENS)).toEqual({
      ok: true,
      demo: { screen: 'pals', t: 0, sim: false, reduce: false },
    });
  });

  it('accepts each screen of the list that it gets', () => {
    expect(readSessionDemo('?session=list-day', [...SCREENS, 'wake']).ok).toBe(true);
    expect(readSessionDemo('?session=wake', [...SCREENS, 'wake']).ok).toBe(true);
  });

  it('names the screens of the list when the screen is unknown', () => {
    const read = readSessionDemo('?session=moon', SCREENS);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.reason).toContain('list-day, night, pals');
  });

  it.each([
    ['no session value', '?session'],
    ['an unknown screen', '?session=moon'],
    ['a negative time', '?session=pals&t=-1'],
    ['a time that is not a number', '?session=pals&t=soon'],
  ])('refuses %s', (_, search) => {
    expect(readSessionDemo(search, SCREENS).ok).toBe(false);
  });
});
