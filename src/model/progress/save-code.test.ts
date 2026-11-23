import { describe, expect, it } from 'vitest';
import { readSaveCode, saveCode, snapshot, songProgress, withSong } from '../index';
import type { SaveData, SavedProgress } from '../index';

// Invented song ids: the repository is public (CLAUDE.md).
const played = (): SavedProgress =>
  withSong(withSong({}, 'paper-moon-parade', { color: 2, stars: 1, weakPlays: 1 }), 'tiny-drum-day', {
    color: 4,
    stars: 3,
    weakPlays: 0,
  });

/** The progress of a save code, or a failure that fails the test with the reason. */
const read = async (code: string): Promise<SavedProgress> => {
  const result = await readSaveCode(code);
  if (!result.ok) {
    throw new Error(`readSaveCode refused the code: ${result.reason}`);
  }
  return result.progress;
};

/** A save code of any JSON value, as a changed or a foreign app could make it. */
const codeOf = async (value: unknown): Promise<string> => saveCode(value as SaveData);

describe('saveCode', () => {
  it('is text that a person can copy: letters, digits, "-", and "_"', async () => {
    expect(await saveCode(snapshot(played()))).toMatch(/^[\w-]+$/u);
  });

  it('is compressed: shorter than the save data as JSON when many songs have a play', async () => {
    const ids = Array.from({ length: 30 }, (_, at) => `invented-song-${String(at)}`);
    const save = snapshot(ids.reduce((saved, id) => withSong(saved, id, { color: 1, stars: 2, weakPlays: 0 }), {}));

    const code = await saveCode(save);

    expect(code.length).toBeLessThan(JSON.stringify(save).length / 2);
  });
});

describe('readSaveCode', () => {
  it('gives the same progress back', async () => {
    const progress = await read(await saveCode(snapshot(played())));

    expect({ ...progress }).toEqual({ ...played() });
    expect(songProgress(progress, 'tiny-drum-day')).toEqual({ color: 4, stars: 3, weakPlays: 0 });
  });

  it('gives the empty progress back', async () => {
    expect(Object.keys(await read(await saveCode(snapshot({}))))).toEqual([]);
  });

  it('reads a code with spaces and line breaks in it', async () => {
    const code = await saveCode(snapshot(played()));
    const pasted = ` ${code.slice(0, 20)}\n${code.slice(20, 40)} \r\n${code.slice(40)}\n`;

    expect({ ...(await read(pasted)) }).toEqual({ ...played() });
  });

  it('builds the progress with a null prototype and keeps only valid song ids', async () => {
    const code = await codeOf({
      version: 1,
      progress: JSON.parse(
        '{"__proto__":{"color":1,"stars":0,"weakPlays":0},"Bad Id":{"color":1,"stars":0,"weakPlays":0},' +
          '"paper-moon-parade":{"color":3,"stars":2,"weakPlays":0}}'
      ),
    });

    const progress = await read(code);

    expect(Object.getPrototypeOf(progress)).toBeNull();
    expect(Object.keys(progress)).toEqual(['paper-moon-parade']);
    expect(songProgress(progress, 'paper-moon-parade')).toEqual({ color: 3, stars: 2, weakPlays: 0 });
  });

  it('refuses the code of an unknown schema version', async () => {
    const code = await saveCode({ ...snapshot(played()), version: 99 });

    expect(await readSaveCode(code)).toEqual({ ok: false, reason: 'version' });
  });

  it('refuses a code with save data of a wrong shape', async () => {
    const wrong = [
      { version: 1 },
      { version: 1, progress: [] },
      { version: 1, progress: { 'tiny-drum-day': { color: 5, stars: 0, weakPlays: 0 } } },
      { version: 1, progress: { 'tiny-drum-day': { color: 0, stars: 3, weakPlays: 0 } } },
      { progress: {} },
      'hello',
      null,
    ];

    const results = await Promise.all(wrong.map(async (value) => readSaveCode(await codeOf(value))));

    expect(results).toEqual(wrong.map(() => ({ ok: false, reason: 'shape' })));
  });

  it('refuses text that is not a save code, and never throws', async () => {
    const code = await saveCode(snapshot(played()));
    const texts = ['', 'hello', 'not a save code!', code.slice(0, code.length / 2), `${code}x`, '{"version":1}'];

    const results = await Promise.all(texts.map(async (text) => readSaveCode(text)));

    expect(results).toEqual(texts.map(() => ({ ok: false, reason: 'shape' })));
  });
});
