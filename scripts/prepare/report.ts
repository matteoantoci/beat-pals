// `prepare-song report`: the chart report on the Mac (spec, "The song pipeline"). It is a report, not a test.
// For each song of the inbox, it gives the child note count for level 0 (its one play) and for each record color and
// speed step. It also gives the notes per minute, the longest gap, and the share of each lane of the band. For each
// fill of a long rest, it gives the start, the end, the source part, and the note count. It reads the charts from the
// .sng files, so it needs no ffmpeg.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type ChartSetup,
  type ChildChart,
  childChart,
  NEW_SONG,
  playSetup,
  RECORD_COLORS,
  type RecordColor,
  type SongFacts,
  type SpeedStep,
} from '../../src/model/index.ts';
import { readGrid } from './grid.ts';
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

const PAL_NAMES = ['Pip', 'Dot', 'Bo'] as const;
/** The report flags a silver or gold chart that gives a lane of the band less than this share (a first value to tune). */
const LOW_LANE_SHARE = 0.15;
const FLAGGED_COLORS: readonly RecordColor[] = ['silver', 'gold'];
const PERCENT = 100;

/** The share of the notes in each lane of the band, in lane order. */
const laneShares = (chart: ChildChart): { lane: number; share: number }[] =>
  chart.band.map((lane) => ({
    lane,
    share:
      chart.notes.length === 0
        ? 0
        : chart.notes.filter((note) => note.lanes.includes(lane)).length / chart.notes.length,
  }));

/** The report row of one record color and speed step. Level 0 also has its rests (playSetup). */
const rowOf = (facts: SongFacts, setup: ChartSetup): string => {
  const { color, step } = setup;
  const chart = childChart(facts, setup);
  const times = chart.notes.map((note) => note.t);
  const shares = laneShares(chart).map(
    ({ lane, share }) => `${PAL_NAMES[lane] ?? '?'} ${String(Math.round(share * PERCENT))}%`
  );
  const length = lengthOf(facts);
  const perMinute = length > 0 ? (times.length * SECONDS_PER_MINUTE) / length : 0;
  return [
    `  ${color.padEnd(9)}`,
    String(step).padStart(4),
    String(times.length).padStart(7),
    perMinute.toFixed(1).padStart(9),
    `  ${longestGap(times).padEnd(16)}`,
    `  ${shares.join(' ')}`,
  ].join('');
};

/** The report line of each fill: from its first note to the end of its last note. */
const fillLines = (facts: SongFacts): string[] =>
  facts.fills.map(({ part, notes }) => {
    const start = notes[0]?.t ?? 0;
    const end = Math.max(...notes.map((note) => note.t + note.lenSec));
    return `  fill ${clock(start)} to ${clock(end)}  ${part}  ${String(notes.length)} notes`;
  });

/** The flag lines of a song: each silver or gold chart that gives a lane of the band less than 15% of the notes. */
const flagLines = (facts: SongFacts): string[] =>
  FLAGGED_COLORS.flatMap((color) => STEPS.map((step) => ({ color, step }))).flatMap(({ color, step }) =>
    laneShares(childChart(facts, { color, step }))
      .filter(({ share }) => share < LOW_LANE_SHARE)
      .map(
        ({ lane, share }) =>
          `  FLAG ${color} step ${String(step)}: ${PAL_NAMES[lane] ?? '?'} has ${String(Math.round(share * PERCENT))}% of the notes`
      )
  );

/** The report lines of one song. */
const songReport = (facts: SongFacts): string[] => {
  const length = lengthOf(facts);
  const beat = medianBeat(facts);
  const tempo = beat > 0 ? ` (${String(Math.round(SECONDS_PER_MINUTE / beat))} BPM)` : '';
  const colorRows = RECORD_COLORS.filter((color) => color !== 'none').flatMap((color) =>
    STEPS.map((step) => rowOf(facts, { color, step }))
  );
  const rows = [rowOf(facts, playSetup(NEW_SONG)), ...colorRows];
  return [
    `${facts.id}: ${facts.title} / ${facts.artist} | notes to ${clock(length)} | beat ${beat.toFixed(2)} s${tempo}`,
    '  color    step  notes  per min  longest gap       lanes',
    ...rows,
    ...flagLines(facts),
    ...(facts.fills.length === 0 ? ['  fills: none'] : fillLines(facts)),
  ];
};

/** Prints the report lines of one song of the inbox. Gives true when the song has a child chart. */
const reportOne = async (inbox: string, song: InboxSong, log: Options['log']): Promise<boolean> => {
  const grid = await readGrid(inbox, song.grid);
  if (!grid.ok) {
    log(`${song.id}: no child chart, ${grid.reason}`);
    return false;
  }
  const result = planSong(song.id, await readFile(join(inbox, song.sng)), { picture: undefined, grid: grid.grid });
  if (!result.ok) {
    log(`${song.id}: no child chart, ${result.reason}`);
    return false;
  }
  songReport(result.plan.facts).forEach((line) => log(line));
  return true;
};

/** Prints the chart report of each song of the inbox, one song at a time, in the song order. */
export const reportSongs = async ({ inbox, log }: Options): Promise<void> => {
  const { songs } = await readInbox(inbox);
  const charted = await songs.reduce<Promise<number>>(
    async (done, song) => (await done) + ((await reportOne(inbox, song, log)) ? 1 : 0),
    Promise.resolve(0)
  );
  log(`report: ${String(songs.length)} songs, ${String(charted)} with a child chart.`);
};
