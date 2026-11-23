// The credits of the parent area (spec, "Screens", parent area): each shipped file of the app, and the chart author
// of each ready song. credits.test.ts checks the list against each shipped file in public/ and src/. The list is
// TypeScript, not JSON, so the Mac scripts can load the model with Node.

type Licence = { readonly name: string; readonly url: string; readonly creditRequired: boolean };

/** One work of the app. `files`: paths below the project root, or all files of one folder ("public/setup/*"). */
type CreditEntry = {
  readonly kind: string;
  readonly title: string;
  readonly author: string;
  readonly licence: string;
  readonly url: string;
  readonly files: readonly string[];
  /** What the app changed in the work. A licence that needs a credit needs this text. */
  readonly change: string;
};

const LICENCES: Readonly<Record<string, Licence>> = {
  'CC0-1.0': {
    name: 'CC0 1.0 (public domain)',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    creditRequired: false,
  },
  own: { name: 'Made for Beat Pals', url: '', creditRequired: false },
};

const ENTRIES: readonly CreditEntry[] = [
  {
    kind: 'music',
    title: 'Happy Adventure (Loop)',
    author: 'TinyWorlds',
    licence: 'CC0-1.0',
    url: 'https://opengameart.org/content/happy-adventure-loop',
    files: ['public/music/title.mp3'],
    change: 'The game skips the silence at the start of the loop.',
  },
  {
    kind: 'picture',
    title: 'App icon',
    author: 'Beat Pals',
    licence: 'own',
    url: '',
    files: ['public/icon.svg'],
    change: 'The build makes the home screen icons from it.',
  },
  {
    kind: 'picture',
    title: 'Song setup pictures',
    author: 'Beat Pals',
    licence: 'own',
    url: '',
    files: ['public/setup/*'],
    change: '',
  },
  {
    kind: 'picture',
    title: 'Launch screens',
    author: 'Beat Pals',
    licence: 'own',
    url: '',
    files: ['public/splash/*'],
    change: '',
  },
];

/** One licence and its works. */
export type CreditGroup = { readonly licence: Licence; readonly entries: readonly CreditEntry[] };

/** The works of the app by licence, the licences that need a credit first. A licence with no work is left out. */
export const CREDIT_GROUPS: readonly CreditGroup[] = Object.entries(LICENCES)
  .map(([key, licence]) => ({ licence, entries: ENTRIES.filter((entry) => entry.licence === key) }))
  .filter((group) => group.entries.length > 0)
  .toSorted((a, b) => Number(b.licence.creditRequired) - Number(a.licence.creditRequired));

/** The licence keys of the list, and each work, for the credits test. */
export const CREDITS: { readonly licences: ReadonlySet<string>; readonly entries: readonly CreditEntry[] } = {
  licences: new Set(Object.keys(LICENCES)),
  entries: ENTRIES,
};

/**
 * The chart authors of the songs, from the `charter` of each facts file: each name one time, in alphabetical
 * order. A chart with no author name is left out.
 */
export const chartAuthors = (charters: readonly string[]): string[] =>
  [...new Set(charters.map((charter) => charter.trim()).filter((charter) => charter !== ''))].toSorted((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' })
  );
