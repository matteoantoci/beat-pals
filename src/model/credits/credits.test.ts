// A check of the shipped data, as in Pile Pals: each picture, music, sound, and font file that the app ships, in
// public/ and in src/, must have an entry in the credits list (credits.ts). The chart authors come from the facts
// files of the ready songs at run time, so the test checks only how they are listed.
import { describe, expect, it } from 'vitest';
import { chartAuthors, CREDIT_GROUPS, CREDITS } from '../index';

// The keys are the paths below the project root, for example "/public/music/title.mp3". Without `eager`, Vite only
// lists the files and does not load them. In src/, only media files ship as files; the code draws the other
// pictures (the pals, the records, the buttons).
const shipped: readonly string[] = Object.keys(
  import.meta.glob(['/public/**/*', '/src/**/*.{svg,png,jpg,jpeg,webp,avif,gif,mp3,m4a,wav,ogg,woff,woff2,ttf,otf}'])
).map((path) => path.slice(1));

/** A credits path is a file ("public/music/title.mp3") or all files of one folder ("public/setup/*"). */
const matches = (pattern: string, file: string): boolean => {
  if (!pattern.endsWith('/*')) {
    return pattern === file;
  }
  const folder = pattern.slice(0, -1);
  return file.startsWith(folder) && !file.slice(folder.length).includes('/');
};

describe('the credits list (src/model/credits/credits.ts)', () => {
  it('finds the shipped files: the title music, the icon, and the setup pictures', () => {
    expect(shipped).toEqual(expect.arrayContaining(['public/music/title.mp3', 'public/icon.svg']));
    expect(shipped.filter((file) => file.startsWith('public/setup/'))).not.toEqual([]);
  });

  it('has an entry for each shipped file', () => {
    const missing = shipped.filter(
      (file) => !CREDITS.entries.some((entry) => entry.files.some((pattern) => matches(pattern, file)))
    );

    expect(missing).toEqual([]);
  });

  it('names only files that the app ships', () => {
    const patterns = CREDITS.entries.flatMap((entry) => entry.files);

    expect(patterns.filter((pattern) => !shipped.some((file) => matches(pattern, file)))).toEqual([]);
  });

  it('gives each entry a licence of the list', () => {
    const unknown = CREDITS.entries.filter((entry) => !CREDITS.licences.has(entry.licence));

    expect(unknown.map((entry) => entry.title)).toEqual([]);
  });

  it('gives each work that needs a credit its title, author, page, and change', () => {
    const needCredit = CREDIT_GROUPS.filter((group) => group.licence.creditRequired).flatMap((group) => group.entries);
    const incomplete = needCredit.filter((entry) => [entry.title, entry.author, entry.url, entry.change].includes(''));

    expect(incomplete.map((entry) => entry.title)).toEqual([]);
  });

  it('names the title music and its author', () => {
    const music = CREDIT_GROUPS.flatMap((group) => group.entries).find((entry) =>
      entry.files.includes('public/music/title.mp3')
    );

    expect(music).toMatchObject({ title: 'Happy Adventure (Loop)', author: 'TinyWorlds', licence: 'CC0-1.0' });
  });
});

describe('chartAuthors', () => {
  it('lists each chart author one time, in alphabetical order', () => {
    expect(chartAuthors(['Zed Charts', 'ann', 'Bob', 'Zed Charts'])).toEqual(['ann', 'Bob', 'Zed Charts']);
  });

  it('leaves out a chart with no author name, and the spaces around a name', () => {
    expect(chartAuthors(['', '  ', ' Bob ', 'Bob'])).toEqual(['Bob']);
  });

  it('is empty with no ready song', () => {
    expect(chartAuthors([])).toEqual([]);
  });
});
