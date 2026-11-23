// Every song name in this file is invented (CLAUDE.md, "Public repository, private songs").

import { describe, expect, it } from 'vitest';
import { findLeaks, fold } from './leaks.ts';
import type { SongNames } from './leaks.ts';

const LONG: SongNames = { id: 'lantern-crew--paper-kites', title: 'Paper Kites', artist: 'Lantern Crew' };
const SHORT_TITLE: SongNames = { id: 'velvet-otters--marmalade', title: 'Marmalade', artist: 'Velvet Otters' };
const SHORT_ARTIST: SongNames = {
  id: 'pebblestone--river-of-buttons',
  title: 'River of Buttons',
  artist: 'Pebblestone',
};
const BOTH_SHORT: SongNames = { id: 'quokka--teacup', title: 'Teacup', artist: 'Quokka' };
const SONGS = [LONG, SHORT_TITLE, SHORT_ARTIST, BOTH_SHORT];

const leaks = (text: string) => findLeaks(text, SONGS).map((leak) => `${leak.kind}: ${leak.name}`);

describe('fold', () => {
  it('folds case and accents', () => {
    expect(fold('CAFÉ Lumière Ñandú')).toBe('cafe lumiere nandu');
  });
});

describe('findLeaks', () => {
  it('finds a song id', () => {
    expect(leaks('const song = "lantern-crew--paper-kites";')).toEqual([
      'id: lantern-crew--paper-kites',
      'title: Paper Kites',
      'artist: Lantern Crew',
    ]);
  });

  it('finds a title of 2 words alone', () => {
    expect(leaks('// Plays Paper Kites at the start.')).toEqual(['title: Paper Kites']);
  });

  it('finds an artist of 2 words alone', () => {
    expect(leaks('A song by velvet otters.')).toEqual(['artist: Velvet Otters']);
  });

  it('finds a one-word title only next to the artist of its song', () => {
    expect(leaks('Spread the marmalade on the toast.')).toEqual([]);
    expect(leaks('Marmalade, by Velvet Otters.')).toEqual(['title: Marmalade', 'artist: Velvet Otters']);
  });

  it('finds a one-word artist only next to the title of its song', () => {
    expect(leaks('The path is made of pebblestone.')).toEqual([]);
    expect(leaks('Pebblestone sings River of Buttons.')).toEqual(['title: River of Buttons', 'artist: Pebblestone']);
  });

  it('finds 2 one-word names of the same song together', () => {
    expect(leaks('Teacup (QUOKKA)')).toEqual(['title: Teacup', 'artist: Quokka']);
  });

  it('does not find a one-word name inside a longer word', () => {
    expect(leaks('Quokkas drink from teacups.')).toEqual([]);
    expect(leaks('Velvet Otters made marmaladeX.')).toEqual(['artist: Velvet Otters']);
  });

  it('matches whole words only for longer names', () => {
    expect(leaks('paper kitesurfing')).toEqual([]);
  });

  it('folds case, accents, and the marks between words', () => {
    const accented: SongNames = { id: 'les-etoiles--cafe-lumiere', title: 'Café Lumière', artist: 'Les Étoiles' };

    expect(findLeaks('cafe_LUMIERE', [accented]).map((leak) => leak.name)).toEqual(['Café Lumière']);
  });

  it('keeps an apostrophe inside a word', () => {
    const song: SongNames = { id: 'the-gnomes--don-t-blink', title: "Don't", artist: 'Gnomes' };

    expect(findLeaks("Don't change the order.", [song])).toEqual([]);
  });
});
