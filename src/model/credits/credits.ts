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
    kind: 'sound',
    title: 'Simple Clap',
    author: 'LordMelchior',
    licence: 'CC0-1.0',
    url: 'https://freesound.org/people/LordMelchior/sounds/213919/',
    files: ['public/sounds/clap.wav', 'public/sounds/clap-great.wav'],
    change:
      'Made from the Freesound HQ preview (MP3). Converted to mono WAV, 16-bit, 44.1 kHz, with the silence at the ' +
      'start and the end removed and the peak at -1 dBFS. The great clap mixes it with TAM.wav and a limiter at -1 dBFS.',
  },
  {
    kind: 'sound',
    title: 'TAM.wav',
    author: 'menegass',
    licence: 'CC0-1.0',
    url: 'https://freesound.org/people/menegass/sounds/99853/',
    files: ['public/sounds/clap-great.wav'],
    change:
      'Made from the Freesound HQ preview (MP3). Converted to mono WAV, 16-bit, 44.1 kHz, with the silence at the ' +
      'start and the end removed and the peak at -1 dBFS. Mixed at 0.8, 30 ms after Simple Clap, into the great clap.',
  },
  {
    kind: 'sound',
    title: 'Interface Sounds',
    author: 'Kenney',
    licence: 'CC0-1.0',
    url: 'https://kenney.nl/assets/interface-sounds',
    files: ['public/sounds/level-up.wav'],
    change:
      'confirmation_001.ogg from the pack. Converted to mono WAV, 16-bit, 44.1 kHz, with the silence at the start ' +
      'and the end removed and the peak at -1 dBFS. The game plays it one whole tone higher for each energy step.',
  },
  {
    kind: 'sound',
    title: 'Level Up Bells',
    author: 'Qvantor',
    licence: 'CC0-1.0',
    url: 'https://freesound.org/people/Qvantor/sounds/878595/',
    files: ['public/sounds/gold.wav'],
    change:
      'Made from the Freesound HQ preview (MP3). Converted to mono WAV, 16-bit, 44.1 kHz, with the silence at the ' +
      'start and the end removed and the peak at -1 dBFS. Cut to 1.5 s with a 0.35 s fade-out.',
  },
  {
    kind: 'sound',
    title: 'Whoosh',
    author: 'qubodup',
    licence: 'CC0-1.0',
    url: 'https://freesound.org/people/qubodup/sounds/60013/',
    files: ['public/sounds/record.wav'],
    change:
      'Made from the Freesound HQ preview (MP3). Converted to mono WAV, 16-bit, 44.1 kHz, with the silence at the ' +
      'start and the end removed and the peak at -1 dBFS.',
  },
  {
    kind: 'sound',
    title: 'cartoon_wink_magic_sparkle.wav',
    author: 'MLaudio',
    licence: 'CC0-1.0',
    url: 'https://freesound.org/people/MLaudio/sounds/511485/',
    files: ['public/sounds/star.wav'],
    change:
      'Made from the Freesound HQ preview (MP3). Converted to mono WAV, 16-bit, 44.1 kHz, with the silence at the ' +
      'start and the end removed and the peak at -1 dBFS.',
  },
  {
    kind: 'sound',
    title: 'Boing 2',
    author: 'magnuswaker',
    licence: 'CC0-1.0',
    url: 'https://freesound.org/people/magnuswaker/sounds/540790/',
    files: ['public/sounds/join.wav'],
    change:
      'The Pile Pals copy (mono WAV, 16-bit, 44.1 kHz), with the silence at the start and the end removed and the ' +
      'peak at -1 dBFS.',
  },
  {
    kind: 'sound',
    title: 'Sliding Trailer Woosh',
    author: 'qubodup',
    licence: 'CC0-1.0',
    url: 'https://freesound.org/people/qubodup/sounds/171255/',
    files: ['public/sounds/star-moment.wav'],
    change:
      'Made from the Freesound HQ preview (MP3). Converted to mono WAV, 16-bit, 44.1 kHz, with the silence at the ' +
      'start and the end removed and the peak at -1 dBFS. Mixed with "Shine Chime" into the star moment sound: the ' +
      'whoosh at full level, the chime at 0.6 and 0.4 s later, a limiter at -1 dBFS, cut with a 0.5 s fade-out. The ' +
      'game plays it a little higher or lower and louder or softer each time.',
  },
  {
    kind: 'sound',
    title: 'Shine Chime',
    author: 'Qvantor',
    licence: 'CC0-1.0',
    url: 'https://freesound.org/people/Qvantor/sounds/879797/',
    files: ['public/sounds/star-moment.wav'],
    change:
      'Made from the Freesound HQ preview (MP3). Converted to mono WAV, 16-bit, 44.1 kHz, with the silence at the ' +
      'start and the end removed and the peak at -1 dBFS. Mixed into the star moment sound after "Sliding Trailer ' +
      'Woosh", at 0.6 and 0.4 s later.',
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
