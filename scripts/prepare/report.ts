// `prepare-song report`: the chart report on the Mac (spec, "The song pipeline"). It is a report, not a test.
// For each song of the inbox, it gives the child note count for each record color and speed step, the notes
// per minute, and the longest gap. It reads the charts from the .sng files, so it needs no ffmpeg.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { childChart, RECORD_COLORS, type RecordColor, type SongFacts, type SpeedStep } from '../../src/model/index.ts';
import { type InboxSong, readInbox } from './inbox.ts';
import { planSong } from './plan.ts';

type Options = {
  /** The songs/ folder. */
  inbox: string;
  log: (line: string) => void;
};

const STEPS: readonly SpeedStep[] = [0, 1, 2];
const SECONDS_PER_MINUTE = 60;

/** A song time as m:ss. */
const clock = (sec: number): string =>
  `${String(Math.floor(sec / SECONDS_PER_MINUTE))}:${String(Math.floor(sec % SECONDS_PER_MINUTE)).padStart(2, '0')}`;

/**
 * The play length for the notes per minute: to the end of the last note of the guitar or a fill. The facts have no
 * song length, and the beats can run on long after the last note.
 */
const lengthOf = (facts: SongFacts): number =>
  Math.max(0, ...[...facts.notes, ...facts.fills.flatMap((fill) => fill.notes)].map((note) => note.t + note.lenSec));

/** The median time between 2 beats of the facts. */
const medianBeat = (facts: SongFacts): number => {
  const gaps = facts.beats.slice(1).map((beat, at) => beat.t - (facts.beats[at]?.t ?? 0));
  return gaps.toSorted((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0;
};

/** The longest time from a child note to the next one, and where it starts. */
const longestGap = (times: readonly number[]): string => {
  const gaps = times.slice(1).map((t, at) => ({ from: times[at] ?? 0, sec: t - (times[at] ?? 0) }));
  const longest = gaps.reduce<{ from: number; sec: number } | undefined>(
    (best, gap) => (best === undefined || gap.sec > best.sec ? gap : best),
    undefined
  );
  return longest === undefined ? 'none' : `${longest.sec.toFixed(1)} s at ${clock(longest.from)}`;
};

/** The report row of one record color and speed step. */
const rowOf = (facts: SongFacts, color: RecordColor, step: SpeedStep): string => {
  const times = childChart(facts, color, step).notes.map((note) => note.t);
  const length = lengthOf(facts);
  const perMinute = length > 0 ? (times.length * SECONDS_PER_MINUTE) / length : 0;
  return [
    `  ${color.padEnd(9)}`,
    String(step).padStart(4),
    String(times.length).padStart(7),
    perMinute.toFixed(1).padStart(9),
    `  ${longestGap(times)}`,
  ].join('');
};

/** The report lines of one song. */
const songReport = (facts: SongFacts): string[] => {
  const length = lengthOf(facts);
  const beat = medianBeat(facts);
  const tempo = beat > 0 ? ` (${String(Math.round(SECONDS_PER_MINUTE / beat))} BPM)` : '';
  const rows = RECORD_COLORS.flatMap((color) => STEPS.map((step) => rowOf(facts, color, step)));
  return [
    `${facts.id}: ${facts.title} / ${facts.artist} | notes to ${clock(length)} | beat ${beat.toFixed(2)} s${tempo}`,
    '  color    step  notes  per min  longest gap',
    ...rows,
  ];
};

/** Prints the report lines of one song of the inbox. Gives true when the song has a child chart. */
const reportOne = async (inbox: string, song: InboxSong, log: Options['log']): Promise<boolean> => {
  const result = planSong(song.id, await readFile(join(inbox, song.sng)), undefined);
  if (!result.ok) {
    log(`${song.id}: no child chart, ${result.reason}`);
    return false;
  }
  songReport(result.plan.facts).forEach((line) => log(line));
  return true;
};

/** Prints the chart report of each song of the inbox, one song at a time, in the song order. */
export const reportSongs = async ({ inbox, log }: Options): Promise<void> => {
  const entries = await readdir(inbox, { withFileTypes: true });
  const { songs } = readInbox(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const charted = await songs.reduce<Promise<number>>(
    async (done, song) => (await done) + ((await reportOne(inbox, song, log)) ? 1 : 0),
    Promise.resolve(0)
  );
  log(`report: ${String(songs.length)} songs, ${String(charted)} with a child chart.`);
};
