import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armPicture, decodePals, decodeSessionPals, palFacePicture, palPicture } from './pal-svg';
import type { PalIndex } from './pal-svg';

// The test runs in Node, so a stand-in for the browser Image lists each picture that a decode gets.
let decoded: string[] = [];

class ListedImage {
  src = '';
  decode(): Promise<void> {
    decoded.push(this.src);
    return Promise.resolve();
  }
}

beforeEach(() => {
  decoded = [];
  vi.stubGlobal('Image', ListedImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const PALS: readonly PalIndex[] = [0, 1, 2];

/** The yawn and sleep faces and the arms of the 3 pals. */
const sessionParts = (): string[] =>
  PALS.flatMap((index) => [palFacePicture(index, 'yawn'), palFacePicture(index, 'sleep'), armPicture(index)]);

describe('the pal pictures', () => {
  it('give the play its 18 pictures, with no session part among them', async () => {
    await decodePals();

    expect(new Set(decoded).size).toBe(18);
    expect(sessionParts().filter((part) => decoded.includes(part))).toEqual([]);
  });

  it('give the session scenes a yawn face, a sleep face, and an arm for each pal', async () => {
    await decodeSessionPals();

    expect(new Set(decoded)).toEqual(new Set(sessionParts()));
    expect(decoded).toHaveLength(9);
  });

  it('give a play face to the session scenes as the same picture as the play', () => {
    expect(palFacePicture(1, 'happy')).toBe(palPicture(1, 'happy'));
  });
});
