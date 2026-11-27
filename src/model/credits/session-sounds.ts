// The credits of the 5 sounds of the session scenes (play-sessions spec, "Sound effects"): each source file of the
// last-song tune, the sun step, the yawn, the goodbye tune, and the wake-up celesta. All are CC0 1.0. The list of
// ./credits.ts holds these entries.

import type { CreditEntry } from './credits';

/** The part of the change text that each of these files shares. */
const CONVERTED =
  'Converted to mono WAV, 16-bit, 44.1 kHz, with the silence at the start and the end removed and the peak at ' +
  '-1 dBFS.';

/** A sound from the Freesound HQ preview (MP3) of a CC0 work. */
const freesound = (work: Pick<CreditEntry, 'title' | 'author' | 'files'>, id: number, change: string) => ({
  kind: 'sound',
  licence: 'CC0-1.0',
  url: `https://freesound.org/people/${work.author}/sounds/${String(id)}/`,
  ...work,
  change: `Made from the Freesound HQ preview (MP3). ${change}`,
});

const LAST_SONG = 'public/sounds/last-song.wav';
const GOODBYE = 'public/sounds/goodbye.wav';

/** The last-song tune and the goodbye tune are built from single notes of "MUSIC BOX" by folkman: each note has an
 * entry with the files that use it. */
const MUSIC_BOX =
  `${CONVERTED} The last-song tune is 4 notes that go up (D6, G6, B6, D7), 0.3 s apart; the last note rings out. ` +
  'The goodbye tune is the same notes that go down, a little slower each time, then a soft G major chord (B5, D6, ' +
  'G6) that rings out.';

const NOTES: readonly { readonly note: string; readonly id: number; readonly files: readonly string[] }[] = [
  { note: 'B 1', id: 70_177, files: [GOODBYE] },
  { note: 'B 2', id: 70_178, files: [LAST_SONG, GOODBYE] },
  { note: 'D 2', id: 70_182, files: [LAST_SONG, GOODBYE] },
  { note: 'D 3', id: 70_183, files: [LAST_SONG, GOODBYE] },
  { note: 'G 2', id: 70_188, files: [LAST_SONG, GOODBYE] },
];

export const SESSION_SOUND_CREDITS: readonly CreditEntry[] = [
  ...NOTES.map(({ note, id, files }) =>
    freesound({ title: `MUSIC BOX ${note}.wav`, author: 'folkman', files }, id, MUSIC_BOX)
  ),
  freesound({ title: 'Kalimba C3', author: 'dvdfu', files: ['public/sounds/sun-step.wav'] }, 536_549, CONVERTED),
  freesound(
    { title: 'long yawn.wav', author: 'Reitanna', files: ['public/sounds/yawn.wav'] },
    252_226,
    `Pitched up 4 semitones by a resample (so it is also 21% faster), for a cartoon voice. ${CONVERTED}`
  ),
  freesound(
    { title: 'glissando_celesta', author: 'HappyPizzaBread', files: ['public/sounds/wake-up.wav'] },
    823_181,
    CONVERTED
  ),
];
