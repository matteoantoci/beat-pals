// The command line of `prepare-song` (spec, "The song pipeline").
// `pnpm prepare-song` prepares each .sng file of songs/ into songs/.prepared/.
// `pnpm prepare-song --only <song-id>` prepares one song.
// `pnpm prepare-song report` prints the chart report of each song of songs/, with no ffmpeg.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ffmpegEncoder } from './ffmpeg.ts';
import { reportSongs } from './report.ts';
import { prepareSongs } from './run.ts';

const SONGS = join(import.meta.dirname, '..', '..', 'songs');

/** Runs the command. Gives the exit code. */
export const main = async (args: readonly string[]): Promise<number> => {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { only: { type: 'string' } },
    allowPositionals: true,
    strict: true,
  });
  const [command, ...extra] = positionals;
  if ((command !== undefined && command !== 'report') || extra.length > 0) {
    console.log(`prepare-song: unknown command ${positionals.join(' ')}. The only command is report.`);
    return 1;
  }
  if (!existsSync(SONGS)) {
    console.log(`prepare-song: the song inbox ${SONGS} does not exist.`);
    return 1;
  }
  if (command === 'report') {
    await reportSongs({ inbox: SONGS, log: (line) => console.log(line) });
    return 0;
  }
  const failed = await prepareSongs({
    inbox: SONGS,
    prepared: join(SONGS, '.prepared'),
    encoder: ffmpegEncoder,
    log: (line) => console.log(line),
    only: values.only,
  });
  return failed === 0 ? 0 : 1;
};
