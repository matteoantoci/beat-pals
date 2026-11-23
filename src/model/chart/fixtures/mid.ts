// The test helper of the .mid reader tests: it writes small notes.mid files in code, so no binary fixture is tracked.

import { writeMidi, type MidiEvent } from 'midi-file';

/** An event at an absolute tick. The helper turns the ticks into delta times. */
type At = { tick: number; event: MidiEvent };

/** The resolution of the fixtures. */
export const RES = 480;

/** An event at a tick. Its delta time is set when the file is written. */
const at = (tick: number, event: MidiEvent): At => ({ tick, event });

export const trackName = (text: string): At => at(0, { deltaTime: 0, type: 'trackName', text, meta: true });

export const text = (tick: number, value: string): At =>
  at(tick, { deltaTime: 0, type: 'text', text: value, meta: true });

const tempo = (tick: number, bpm: number): At =>
  at(tick, { deltaTime: 0, type: 'setTempo', microsecondsPerBeat: Math.round(60_000_000 / bpm), meta: true });

export const timeSignature = (tick: number, numerator: number, denominator: number): At =>
  at(tick, {
    deltaTime: 0,
    type: 'timeSignature',
    numerator,
    denominator,
    metronome: 24,
    thirtyseconds: 8,
    meta: true,
  });

/** A note on and its note off, `length` ticks later. */
export const note = (tick: number, pitch: number, length = 10): At[] => [
  at(tick, { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: pitch, velocity: 100 }),
  at(tick + length, { deltaTime: 0, type: 'noteOff', channel: 0, noteNumber: pitch, velocity: 0 }),
];

/** A Phase Shift SysEx open phrase for one difficulty (3 is Expert), from `start` to `end`. */
export const openPhrase = (start: number, end: number, difficulty: number): At[] =>
  [start, end].map((tick, index) =>
    at(tick, {
      deltaTime: 0,
      type: 'sysEx',
      data: [0x50, 0x53, 0x00, 0x00, difficulty, 0x01, index === 0 ? 1 : 0, 0xf7],
    })
  );

/** The bytes of a type 1 .mid file with these tracks. */
export const midFile = (tracks: readonly (readonly At[])[]): Uint8Array =>
  Uint8Array.from(
    writeMidi({
      header: { format: 1, numTracks: tracks.length, ticksPerBeat: RES },
      tracks: tracks.map((events) => {
        const sorted = events.toSorted((a, b) => a.tick - b.tick);
        const last = sorted.at(-1)?.tick ?? 0;
        return [...sorted, at(last, { deltaTime: 0, type: 'endOfTrack', meta: true })].map(
          ({ tick, event }, index, all) => Object.assign(event, { deltaTime: tick - (all[index - 1]?.tick ?? 0) })
        );
      }),
    })
  );

/** A tempo track at 120 BPM in 4/4, so 480 ticks are 0.5 s. */
export const TEMPO_TRACK = [trackName('Test Tune'), timeSignature(0, 4, 4), tempo(0, 120)];
