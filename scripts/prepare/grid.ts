// The grid override of a song: `songs/<song-id>.grid.json` (spec, "The song pipeline"). In some charts the notes
// match the audio but the beat grid does not, and then the child filter drops notes that are on the beat. The
// override replaces the beats of the facts with a steady grid: one tempo, one bar length, and the time of one
// downbeat. The grid runs from time 0 to the last beat of the chart.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SongFacts } from '../../src/model/index.ts';

export type GridOverride = { bpm: number; downbeat: number; beatsPerBar: number };

/** The grid override file of a song: its bytes for the stamp and its grid, both undefined when the song has none. */
type GridRead =
  | { ok: true; bytes: Uint8Array | undefined; grid: GridOverride | undefined }
  | { ok: false; reason: string };

const SECONDS_PER_MINUTE = 60;
const REFUSED =
  'The grid override needs "bpm" above 0, "downbeat" (s) from 0, and "beatsPerBar" (a whole number from 1).';

/** Times keep 6 decimals (microseconds), as in the facts file of the chart reader. */
const round = (sec: number): number => Math.round(sec * 1e6) / 1e6;

/** True for a number from `min` up. */
const numberFrom = (value: unknown, min: number): value is number => typeof value === 'number' && value >= min;

/** The grid override from the text of its file, or the reason why it is refused. */
const parseGrid = (text: string): { ok: true; grid: GridOverride } | { ok: false; reason: string } => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'The grid override is not JSON.' };
  }
  const fields = new Map(typeof value === 'object' && value !== null ? Object.entries(value) : []);
  const bpm: unknown = fields.get('bpm');
  const downbeat: unknown = fields.get('downbeat');
  const beatsPerBar: unknown = fields.get('beatsPerBar');
  // The tempo must be above 0, so its lowest value is the smallest positive number.
  if (!numberFrom(bpm, Number.MIN_VALUE) || !numberFrom(downbeat, 0) || !numberFrom(beatsPerBar, 1)) {
    return { ok: false, reason: REFUSED };
  }
  if (!Number.isInteger(beatsPerBar)) {
    return { ok: false, reason: REFUSED };
  }
  return { ok: true, grid: { bpm, downbeat, beatsPerBar } };
};

/** Reads the grid override `name` of the inbox. A song with no grid override gives no bytes and no grid. */
export const readGrid = async (inbox: string, name: string | undefined): Promise<GridRead> => {
  if (name === undefined) {
    return { ok: true, bytes: undefined, grid: undefined };
  }
  const bytes = await readFile(join(inbox, name));
  const parsed = parseGrid(new TextDecoder().decode(bytes));
  return parsed.ok ? { ok: true, bytes, grid: parsed.grid } : parsed;
};

/** The beats of the steady grid, from time 0 up to `end` (the last beat of the chart). */
export const steadyBeats = ({ bpm, downbeat, beatsPerBar }: GridOverride, end: number): SongFacts['beats'] => {
  const period = SECONDS_PER_MINUTE / bpm;
  const first = -Math.floor(downbeat / period);
  const count = Math.floor((end - downbeat) / period) - first + 1;
  return Array.from({ length: Math.max(0, count) }, (_, at) => {
    const index = first + at;
    return { t: round(downbeat + index * period), downbeat: index % beatsPerBar === 0 };
  });
};
