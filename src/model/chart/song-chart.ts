// The chart of a song from its files (spec, "The facts file"): notes.mid when it exists, else notes.chart.

import { readChart } from './chart-file';
import { readMid } from './mid-file';
import type { ChartResult, SongMeta } from './facts';

/** The chart files of a song: the bytes of `notes.mid` and the text of `notes.chart`, when they exist. */
type SongChartFiles = { mid?: Uint8Array; chart?: string };

/** Reads the facts of a song from its chart files. `notes.mid` wins over `notes.chart`. */
export const readSongChart = (files: SongChartFiles, meta: SongMeta): ChartResult => {
  if (files.mid !== undefined) {
    return readMid(files.mid, meta);
  }
  if (files.chart !== undefined) {
    return readChart(files.chart, meta);
  }
  return { ok: false, reason: 'The song has no notes.mid and no notes.chart.' };
};
