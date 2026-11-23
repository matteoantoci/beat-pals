// The command line of `prepare-song` (spec, "The song pipeline").
// `pnpm prepare-song` prepares each .sng file of songs/ into songs/.prepared/.
// `pnpm prepare-song --only <song-id>` prepares one song.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ffmpegEncoder } from './ffmpeg.ts';
import { prepareSongs } from './run.ts';

const SONGS = join(import.meta.dirname, '..', '..', 'songs');

/** Runs the command. Gives the exit code. */
export const main = async (args: readonly string[]): Promise<number> => {
  const { values } = parseArgs({ args: [...args], options: { only: { type: 'string' } }, strict: true });
  if (!existsSync(SONGS)) {
    console.log(`prepare-song: the song inbox ${SONGS} does not exist.`);
    return 1;
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
