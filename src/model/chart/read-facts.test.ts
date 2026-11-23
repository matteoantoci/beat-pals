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
};

describe('readFacts', () => {
  it('reads a facts file of version 1', () => {
    expect(readFacts(JSON.stringify(FACTS))).toEqual(FACTS);
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
