import { describe, expect, it } from 'vitest';
import { NEW_SONG, restore, outcomeOf, snapshot, songProgress, withSong } from '../index';
import type { SavedProgress } from '../index';

// Invented song ids: the repository is public (CLAUDE.md).
const played = (): SavedProgress =>
  withSong(withSong({}, 'paper-moon-parade', { color: 2, stars: 1, weakPlays: 1 }), 'tiny-drum-day', {
    color: 4,
    stars: 3,
    weakPlays: 0,
  });

/** The progress of a restored save, or a failure that fails the test with the reason. */
const restored = (save: unknown): SavedProgress => {
  const result = restore(save);
  if (!result.ok) {
    throw new Error(`restore refused the save: ${result.reason}`);
  }
  return result.progress;
};

/** The save as localStorage or a save code gives it back. */
const throughJson = (save: unknown): unknown => JSON.parse(JSON.stringify(save));

describe('the progress of a song', () => {
  it('is level 0 (no record) with 0 stars for a song with no play', () => {
    expect(songProgress(played(), 'never-played')).toEqual(NEW_SONG);
    expect(songProgress(played(), 'constructor')).toEqual(NEW_SONG);
  });

  it('keeps the other songs when one song changes', () => {
    const before = played();
    const outcome = outcomeOf(songProgress(before, 'paper-moon-parade'), 1);

    const after = withSong(before, 'paper-moon-parade', outcome.after);

    expect(songProgress(after, 'paper-moon-parade')).toEqual({ color: 2, stars: 2, weakPlays: 0 });
    expect(songProgress(after, 'tiny-drum-day')).toEqual({ color: 4, stars: 3, weakPlays: 0 });
    expect(songProgress(before, 'paper-moon-parade')).toEqual({ color: 2, stars: 1, weakPlays: 1 });
  });
});

describe('snapshot and restore', () => {
  it('holds a version and the progress of each song', () => {
    expect(throughJson(snapshot(played()))).toEqual({
      version: 1,
      progress: {
        'paper-moon-parade': { color: 2, stars: 1, weakPlays: 1 },
        'tiny-drum-day': { color: 4, stars: 3, weakPlays: 0 },
      },
    });
  });

  it('gives the same progress back after the JSON of localStorage', () => {
    expect({ ...restored(throughJson(snapshot(played()))) }).toEqual({ ...played() });
  });

  it('keeps a song id that is not in the song list, so a song that returns keeps its stars', () => {
    const save = { version: 1, progress: { 'gone-for-now': { color: 1, stars: 2, weakPlays: 0 } } };

    expect(songProgress(restored(save), 'gone-for-now')).toEqual({ color: 1, stars: 2, weakPlays: 0 });
  });

  it('builds the progress map with a null prototype', () => {
    expect(Object.getPrototypeOf(restored(throughJson(snapshot(played()))))).toBeNull();
  });

  it('leaves out each song id that does not match ^[a-z0-9-]+$', () => {
    const save = JSON.parse(
      '{"version":1,"progress":{"__proto__":{"color":4,"stars":3,"weakPlays":0},' +
        '"Big Song":{"color":1,"stars":0,"weakPlays":0},"ok-song-2":{"color":1,"stars":0,"weakPlays":0}}}'
    ) as unknown;

    const progress = restored(save);

    expect(Object.keys(progress)).toEqual(['ok-song-2']);
    expect(Object.getPrototypeOf(progress)).toBeNull();
    expect(Object.prototype).not.toHaveProperty('color');
  });

  it('drops fields that the progress does not have', () => {
    const save = { version: 1, progress: { 'a-song': { color: 1, stars: 1, weakPlays: 0, extra: true } } };

    expect({ ...restored(save)['a-song'] }).toEqual({ color: 1, stars: 1, weakPlays: 0 });
  });
});

describe('restore of old and damaged shapes', () => {
  it('refuses a save of another version', () => {
    expect(restore({ version: 0, progress: {} })).toEqual({ ok: false, reason: 'version' });
    expect(restore({ version: 2, progress: {} })).toEqual({ ok: false, reason: 'version' });
  });

  it('refuses a save of the sister game, which has a state and no progress', () => {
    expect(restore({ version: 4, state: { level: 3 } })).toEqual({ ok: false, reason: 'version' });
  });

  it('refuses data with no version', () => {
    expect(restore(null)).toEqual({ ok: false, reason: 'shape' });
    expect(restore('save')).toEqual({ ok: false, reason: 'shape' });
    expect(restore({ progress: {} })).toEqual({ ok: false, reason: 'shape' });
    expect(restore({ version: '1', progress: {} })).toEqual({ ok: false, reason: 'shape' });
  });

  it('refuses a save with no progress map', () => {
    expect(restore({ version: 1 })).toEqual({ ok: false, reason: 'shape' });
    expect(restore({ version: 1, progress: [] })).toEqual({ ok: false, reason: 'shape' });
  });

  it('refuses a progress value out of its range', () => {
    const refused = [
      { color: 5, stars: 0, weakPlays: 0 },
      { color: 1, stars: 4, weakPlays: 0 },
      { color: 1, stars: 1, weakPlays: 3 },
      { color: 1, stars: 1 },
      { color: '1', stars: 1, weakPlays: 0 },
      // The third star of a color below platinum opens the next color.
      { color: 3, stars: 3, weakPlays: 0 },
    ];

    for (const value of refused) {
      expect(restore({ version: 1, progress: { 'a-song': value } })).toEqual({ ok: false, reason: 'shape' });
    }
  });

  it('reads an empty save', () => {
    expect(Object.keys(restored({ version: 1, progress: {} }))).toEqual([]);
  });
});
