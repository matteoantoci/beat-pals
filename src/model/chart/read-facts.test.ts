import { describe, expect, it } from 'vitest';
import { readFacts } from '../index';

// An invented song.
const FACTS = {
  version: 1,
  id: 'paper-kites',
  title: 'Paper Kites',
  artist: 'The Lanterns',
  charter: 'Mossy Fern',
  beats: [{ t: 0, downbeat: true }],
  notes: [{ t: 1, frets: [0], lenSec: 0 }],
  fills: [],
  phrases: [{ t: 1, end: 3 }],
  phraseSource: 'chart',
};

describe('readFacts', () => {
  it('reads a facts file of version 1', () => {
    expect(readFacts(JSON.stringify(FACTS))).toEqual(FACTS);
  });

  it('reads a facts file from before the star moments as a song with no phrases', () => {
    const { phrases: _phrases, phraseSource: _source, ...old } = FACTS;
    expect(readFacts(JSON.stringify(old))).toEqual({ ...old, phrases: [], phraseSource: 'fallback' });
  });

  it.each([
    ['a newer version', JSON.stringify({ ...FACTS, version: 2 })],
    ['a missing list', JSON.stringify({ ...FACTS, notes: undefined })],
    ['no object', '[1, 2]'],
    ['no JSON', '{ version: 1'],
  ])('refuses %s', (_case, json) => {
    expect(readFacts(json)).toBeUndefined();
  });
});
