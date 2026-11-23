// The .chart reader (chart-formats.md, section 2). It reads the text into a `TickChart` and makes the facts.
// Sections can come in any order, and events in a section can come in the wrong order.

import { highestDifficulty } from './difficulty';
import { buildFacts, type ChartResult, type SongMeta, type TickNote } from './facts';

/** One `<tick> = <code> <values>` line of a section. */
type ChartEvent = { tick: number; code: string; values: string[] };

const SECTION = /^\[(.+)\]$/u;
const EVENT = /^(\d+)\s*=\s*([A-Za-z]+)\s*(.*)$/u;
const PAIR = /^(\w+)\s*=\s*(.*)$/u;

/** The `N` types that are frets: green to orange, and open. Types 5 and 6 are the forced and tap flags. */
const FRETS = new Set([0, 1, 2, 3, 4, 7]);

/** A .chart tempo is the BPM times 1000. */
const BPM_SCALE = 1000;

/** A time signature without its second value has the denominator 2^2, so it is x/4. */
const QUARTER_EXPONENT = 2;

/** The lines of each section, by section name. The braces and the empty lines are left out. */
const sectionsOf = (text: string): ReadonlyMap<string, readonly string[]> => {
  const sections = new Map<string, string[]>();
  let current: string[] = [];
  text
    .replace(/^\uFEFF/u, '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .forEach((line) => {
      const name = SECTION.exec(line)?.[1];
      if (name !== undefined) {
        current = [];
        sections.set(name, current);
      } else if (line !== '{' && line !== '}' && line !== '') {
        current.push(line);
      }
    });
  return sections;
};

const eventsOf = (lines: readonly string[] | undefined): ChartEvent[] =>
  (lines ?? []).flatMap((line) => {
    const [, tick = '', code = '', rest = ''] = EVENT.exec(line) ?? [];
    return code === '' ? [] : [{ tick: Number(tick), code, values: rest.split(/\s+/u) }];
  });

/** The `Key = Value` pairs of the `[Song]` section. The quotes around a value are removed. */
const songValues = (lines: readonly string[] | undefined): ReadonlyMap<string, string> =>
  new Map(
    (lines ?? []).flatMap((line) => {
      const [, key = '', value = ''] = PAIR.exec(line) ?? [];
      return key === '' ? [] : [[key, value.replace(/^"(.*)"$/u, '$1')] as const];
    })
  );

/** The fret notes of an instrument section. Flags, star power, and text events are left out. */
const fretNotes = (lines: readonly string[] | undefined): TickNote[] =>
  eventsOf(lines).flatMap(({ tick, code, values: [type, length] }) => {
    const fret = Number(type);
    return code === 'N' && FRETS.has(fret) ? [{ tick, fret, length: Number(length) || 0 }] : [];
  });

/** The kick (0) and the double kick of Expert+ (32) are open. The pads 1 to 5 (red to green) are the frets 0 to 4. Cymbal flags are left out. */
const KICKS = new Set([0, 32]);
const LAST_PAD = 5;
const OPEN = 7;

/** The drum notes of a drums section, with the pads as frets. */
const drumNotes = (lines: readonly string[] | undefined): TickNote[] =>
  eventsOf(lines).flatMap(({ tick, code, values: [type, length] }) => {
    const pad = Number(type);
    if (code !== 'N' || !(KICKS.has(pad) || (pad >= 1 && pad <= LAST_PAD))) {
      return [];
    }
    return [{ tick, fret: KICKS.has(pad) ? OPEN : pad - 1, length: Number(length) || 0 }];
  });

const temposOf = (sync: readonly ChartEvent[]) =>
  sync
    .filter((event) => event.code === 'B')
    .map(({ tick, values: [tempo] }) => ({ tick, bpm: Number(tempo) / BPM_SCALE }))
    .filter((tempo) => tempo.bpm > 0);

const timeSignaturesOf = (sync: readonly ChartEvent[]) =>
  sync
    .filter((event) => event.code === 'TS')
    .map(({ tick, values: [numerator, exponent] }) => ({
      tick,
      numerator: Number(numerator),
      denominator: 2 ** (exponent === undefined ? QUARTER_EXPONENT : Number(exponent)),
    }))
    .filter(
      (signature) =>
        Number.isInteger(signature.numerator) && signature.numerator > 0 && Number.isInteger(signature.denominator)
    );

/** The last tick of all sections, with sustain ends. */
const endTickOf = (sections: ReadonlyMap<string, readonly string[]>): number =>
  Math.max(
    0,
    ...[...sections.values()].flatMap((lines) =>
      eventsOf(lines).map(
        ({ tick, code, values: [, length] }) => tick + (code === 'N' || code === 'S' ? Number(length) || 0 : 0)
      )
    )
  );

/** Reads a .chart file into the facts of its song. The caller gives the metadata pairs of the song. */
export const readChart = (text: string, meta: SongMeta): ChartResult => {
  const sections = sectionsOf(text);
  const song = songValues(sections.get('Song'));
  const resolution = Number(song.get('Resolution'));
  if (!(resolution > 0)) {
    return { ok: false, reason: 'The chart has no Resolution in its [Song] section.' };
  }
  const sync = eventsOf(sections.get('SyncTrack'));
  const chart = {
    resolution,
    offsetSec: Number(song.get('Offset')) || 0,
    tempos: temposOf(sync),
    timeSignatures: timeSignaturesOf(sync),
    beats: undefined,
    guitar: highestDifficulty((difficulty) => fretNotes(sections.get(`${difficulty}Single`))),
    parts: {
      bass: highestDifficulty((difficulty) => fretNotes(sections.get(`${difficulty}DoubleBass`))),
      keys: highestDifficulty((difficulty) => fretNotes(sections.get(`${difficulty}Keyboard`))),
      drums: highestDifficulty((difficulty) => drumNotes(sections.get(`${difficulty}Drums`))),
    },
    endTick: endTickOf(sections),
  };
  return buildFacts(chart, meta);
};
