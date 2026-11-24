// The .mid reader (chart-formats.md, section 3). It reads `notes.mid` with `midi-file` into a `TickChart` and makes the facts.
// Tempos and time signatures come from all tracks. Unknown tracks are ignored.

import { parseMidi, type MidiEvent } from 'midi-file';
import { highestDifficulty, type Difficulty } from './difficulty';
import { buildFacts, type ChartResult, type SongMeta, type TickChart, type TickNote } from './facts';
import type { BeatTick, TimeSignature } from './beats';
import type { Tempo } from './tempo';

/** An event with its absolute tick. */
type Timed = { tick: number; event: MidiEvent };

/** A pitch held from `tick` for `length` ticks. */
type MidNote = { tick: number; pitch: number; length: number };

/** The green pitch and the Phase Shift SysEx number of each difficulty. The open pitch is one below green. */
const DIFFICULTY_PITCH: Record<Difficulty, { green: number; sysEx: number }> = {
  Expert: { green: 96, sysEx: 3 },
  Hard: { green: 84, sysEx: 2 },
  Medium: { green: 72, sysEx: 1 },
  Easy: { green: 60, sysEx: 0 },
};

const OPEN = 7;
const ORANGE = 4;

/** Notes this many ticks apart or less snap into one chord. */
const CHORD_SNAP = 10;

/** The `BEAT` track notes: 12 is a downbeat, 13 is another beat. */
const DOWNBEAT = 12;
const BEAT = 13;

/** The Star Power phrase note of the guitar track, for all difficulties. */
const STAR_POWER = 116;
/** A section marker text event of the `EVENTS` track: `[section <name>]` or `[prc_<name>]`. */
const SECTION_MARKER = /^\[?(?:section[ _]|prc_)/u;

/** A Phase Shift SysEx payload: 'P' 'S' 0x00 <type 0x00> <difficulty> <modifier> <1 start | 0 end>. 0xFF is all difficulties. */
const PS_HEADER = [0x50, 0x53, 0x00, 0x00];
const PS_ALL = 0xff;
const PS_OPEN = 0x01;

const MICROSECONDS_PER_MINUTE = 60_000_000;

const timed = (events: readonly MidiEvent[]): Timed[] => {
  let tick = 0;
  return events.map((event) => {
    tick += event.deltaTime;
    return { tick, event };
  });
};

const nameOf = (track: readonly Timed[]): string | undefined =>
  track.flatMap(({ event }) => (event.type === 'trackName' ? [event.text] : []))[0];

/** The notes of a track, each note on paired with the next note off of its pitch. A note on with velocity 0 is a note off. */
const notesOf = (track: readonly Timed[]): MidNote[] => {
  const held = new Map<number, number>();
  const notes: MidNote[] = [];
  track.forEach(({ tick, event }) => {
    if (event.type !== 'noteOn' && event.type !== 'noteOff') {
      return;
    }
    const start = held.get(event.noteNumber);
    held.delete(event.noteNumber);
    if (start !== undefined) {
      notes.push({ tick: start, pitch: event.noteNumber, length: tick - start });
    }
    if (event.type === 'noteOn' && event.velocity > 0) {
      held.set(event.noteNumber, tick);
    }
  });
  return notes;
};

/** Whether an event is a Phase Shift open phrase event for one SysEx difficulty, and if so whether it starts the phrase. */
const openPhraseEvent = (event: MidiEvent, sysEx: number): 'start' | 'end' | undefined => {
  if (event.type !== 'sysEx') {
    return undefined;
  }
  const data = Array.from(event.data);
  const isOpen =
    PS_HEADER.every((byte, index) => data[index] === byte) &&
    (data[4] === sysEx || data[4] === PS_ALL) &&
    data[5] === PS_OPEN;
  if (!isOpen) {
    return undefined;
  }
  return data[6] === 1 ? 'start' : 'end';
};

/** The tick ranges of the Phase Shift open phrases for one SysEx difficulty. */
const openPhrases = (track: readonly Timed[], sysEx: number): { start: number; end: number }[] => {
  const phrases: { start: number; end: number }[] = [];
  let start: number | undefined;
  track.forEach(({ tick, event }) => {
    const kind = openPhraseEvent(event, sysEx);
    if (kind === 'start') {
      start = tick;
    } else if (kind === 'end' && start !== undefined) {
      phrases.push({ start, end: tick });
      start = undefined;
    }
  });
  return phrases;
};

/** The fret notes of the guitar track at one difficulty. */
const fretNotes = (track: readonly Timed[], notes: readonly MidNote[], difficulty: Difficulty): TickNote[] => {
  const { green, sysEx } = DIFFICULTY_PITCH[difficulty];
  const enhancedOpens = track.some(
    ({ event }) => event.type === 'text' && event.text.replace(/^\[(.*)\]$/u, '$1') === 'ENHANCED_OPENS'
  );
  const phrases = openPhrases(track, sysEx);
  return notes.flatMap(({ tick, pitch, length }) => {
    const fret = pitch - green;
    if (fret === -1) {
      return enhancedOpens ? [{ tick, fret: OPEN, length }] : [];
    }
    if (fret < 0 || fret > ORANGE) {
      return [];
    }
    const inPhrase = fret === 0 && phrases.some((phrase) => tick >= phrase.start && tick < phrase.end);
    return [{ tick, fret: inPhrase ? OPEN : fret, length }];
  });
};

/** The drum notes of the drums track at one difficulty. The kick (the green pitch, or one below it for Expert+) is open, and the pads from red are the frets 0 to 4. */
const drumNotes = (notes: readonly MidNote[], difficulty: Difficulty): TickNote[] => {
  const kick = DIFFICULTY_PITCH[difficulty].green;
  return notes.flatMap(({ tick, pitch, length }) => {
    const pad = pitch - kick;
    if (pad === 0 || (pad === -1 && difficulty === 'Expert')) {
      return [{ tick, fret: OPEN, length }];
    }
    return pad >= 1 && pad <= ORANGE + 1 ? [{ tick, fret: pad - 1, length }] : [];
  });
};

/** Snaps each note to the first note of its chord, when it is `CHORD_SNAP` ticks or less after it. Sustain ends stay. */
const snapChords = (notes: readonly TickNote[]): TickNote[] => {
  let anchor = Number.NEGATIVE_INFINITY;
  return notes
    .toSorted((a, b) => a.tick - b.tick)
    .map((note) => {
      if (note.tick - anchor > CHORD_SNAP) {
        anchor = note.tick;
      }
      return { tick: anchor, fret: note.fret, length: note.tick + note.length - anchor };
    });
};

const beatsOf = (track: readonly Timed[] | undefined): BeatTick[] | undefined => {
  const beats = notesOf(track ?? [])
    .filter((note) => note.pitch === DOWNBEAT || note.pitch === BEAT)
    .map((note) => ({ tick: note.tick, downbeat: note.pitch === DOWNBEAT }))
    .toSorted((a, b) => a.tick - b.tick);
  return beats.length > 0 ? beats : undefined;
};

/** The Star Power phrases of the guitar track and the section markers of the events track. */
const phraseMarks = (tracks: readonly (readonly Timed[])[]): Pick<TickChart, 'starPower' | 'sections'> => ({
  starPower: notesOf(tracks.find((track) => nameOf(track) === 'PART GUITAR') ?? [])
    .filter((note) => note.pitch === STAR_POWER)
    .map(({ tick, length }) => ({ tick, length })),
  sections: (tracks.find((track) => nameOf(track) === 'EVENTS') ?? []).flatMap(({ tick, event }) =>
    event.type === 'text' && SECTION_MARKER.test(event.text) ? [tick] : []
  ),
});

/** Reads a notes.mid file into the facts of its song. The caller gives the metadata pairs of the song. */
export const readMid = (bytes: Uint8Array, meta: SongMeta): ChartResult => {
  let midi;
  try {
    midi = parseMidi(bytes);
  } catch {
    return { ok: false, reason: 'The notes.mid file is not a valid MIDI file.' };
  }
  const resolution = midi.header.ticksPerBeat;
  if (resolution === undefined || !(resolution > 0)) {
    return { ok: false, reason: 'The notes.mid file has no ticks per beat.' };
  }
  const tracks = midi.tracks.map(timed);
  const all = tracks.flat();
  const tempos: Tempo[] = all.flatMap(({ tick, event }) =>
    event.type === 'setTempo' && event.microsecondsPerBeat > 0
      ? [{ tick, bpm: MICROSECONDS_PER_MINUTE / event.microsecondsPerBeat }]
      : []
  );
  const timeSignatures: TimeSignature[] = all.flatMap(({ tick, event }) =>
    event.type === 'timeSignature' && event.numerator > 0 && event.denominator > 0
      ? [{ tick, numerator: event.numerator, denominator: event.denominator }]
      : []
  );
  const fretPart = (name: string): TickNote[] | undefined => {
    const track = tracks.find((each) => nameOf(each) === name);
    const notes = notesOf(track ?? []);
    const part =
      track === undefined ? undefined : highestDifficulty((difficulty) => fretNotes(track, notes, difficulty));
    return part === undefined ? undefined : snapChords(part);
  };
  const drumTrack = notesOf(tracks.find((track) => nameOf(track) === 'PART DRUMS') ?? []);
  const drums = highestDifficulty((difficulty) => drumNotes(drumTrack, difficulty));
  const chart: TickChart = {
    resolution,
    offsetSec: 0,
    tempos,
    timeSignatures,
    beats: beatsOf(tracks.find((track) => nameOf(track) === 'BEAT')),
    guitar: fretPart('PART GUITAR'),
    parts: {
      bass: fretPart('PART BASS'),
      keys: fretPart('PART KEYS'),
      drums: drums === undefined ? undefined : snapChords(drums),
    },
    endTick: Math.max(0, ...all.map(({ tick }) => tick)),
    ...phraseMarks(tracks),
  };
  return buildFacts(chart, meta);
};
