// The test store of the smoke run (spec, "Testing Decisions", Seam 2): one short song, a click track that ffmpeg
// makes, with the fixture chart smoke-click.chart, encrypted with a new test key into a store of its own. The store
// goes to dist/songs/, as `deploy` copies songs/.site/ there. The run never reads or writes songs/ or the key folder
// of the Parent: the test key lives in a temporary folder, which the run removes at the end.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readChart } from '../src/model/index.ts';
import { loadKey, makeKey, readKeyCode } from './prepare/key.ts';
import { storeSongs } from './prepare/store.ts';

const SONG_ID = 'click-test';
/** The song lasts 15 s: the chart has notes from 2.0 s to 13.5 s at 120 BPM. */
const SECONDS = 15;
/** A click of 30 ms on each beat (0.5 s at 120 BPM). */
const CLICK = 'sin(2*PI*1000*t)*lt(mod(t\\,0.5)\\,0.03)*0.6';

type Result<T> = { ok: true; value: T } | { ok: false; reason: string };

const value = <T>(result: Result<T>, step: string): T => {
  if (!result.ok) {
    throw new Error(`smoke store, ${step}: ${result.reason}`);
  }
  return result.value;
};

/** Makes the click track as AAC in an .m4a file. */
const clickTrack = async (file: string): Promise<void> => {
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `aevalsrc=${CLICK}:s=44100:d=${String(SECONDS)}`,
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-y',
      file,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
  await once(ffmpeg, 'exit');
  if (ffmpeg.exitCode !== 0) {
    throw new Error(`smoke store: ffmpeg stopped with code ${String(ffmpeg.exitCode)}.`);
  }
};

/** The prepared song: the facts of the fixture chart and the click track. */
const prepare = async (folder: string): Promise<void> => {
  await mkdir(folder, { recursive: true });
  const chart = await readFile(join(import.meta.dirname, 'smoke-click.chart'), 'utf8');
  const meta = { id: SONG_ID, name: 'Click Test', artist: 'Smoke Run', charter: 'Smoke Run', delay: 0 };
  const facts = readChart(chart, meta);
  if (!facts.ok) {
    throw new Error(`smoke store: the fixture chart is refused: ${facts.reason}`);
  }
  await writeFile(join(folder, 'song.json'), JSON.stringify(facts.facts));
  await clickTrack(join(folder, 'song.m4a'));
};

/** Makes the test key and the store in `work`, and gives the key code. */
const makeStore = async (work: string, site: string): Promise<string> => {
  const keyFolder = join(work, 'key');
  value(await makeKey(keyFolder), 'key');
  const key = value(await loadKey(keyFolder), 'key');
  await prepare(join(work, 'prepared', SONG_ID));
  const stored = await storeSongs({ prepared: join(work, 'prepared'), site, key, log: () => undefined });
  if (!stored.ok) {
    throw new Error(`smoke store: ${stored.reason}`);
  }
  return value(await readKeyCode(keyFolder), 'key code');
};

/**
 * Builds the test store in `dist/songs/` and gives the key code of its test key, for the key step of the song
 * setup. Call it after `vite build`, which empties dist/.
 */
export const buildSmokeStore = async (dist: string): Promise<string> => {
  const work = await mkdtemp(join(tmpdir(), 'bp-smoke-'));
  try {
    return await makeStore(work, join(dist, 'songs'));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
};
