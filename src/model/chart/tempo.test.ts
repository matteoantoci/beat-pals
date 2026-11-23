import { describe, expect, it } from 'vitest';
import { factsOf } from './fixtures/facts-of';
import noTempo from './fixtures/no-tempo.chart?raw';
import offset from './fixtures/offset.chart?raw';
import tempoChange480 from './fixtures/tempo-change-480.chart?raw';
import tempoChange from './fixtures/tempo-change.chart?raw';
import wrongOrder from './fixtures/wrong-order.chart?raw';

describe('readChart times', () => {
  it('gives each note its time over the tempo map', () => {
    expect(factsOf(tempoChange).notes.map((note) => note.t)).toEqual([1.5, 2, 3]);
  });

  it('ends a sustain at the time of its tick plus its length, also over a tempo change', () => {
    expect(factsOf(tempoChange).notes.map((note) => note.lenSec)).toEqual([1.5, 0, 1]);
  });

  it('plays at 120 BPM up to the first tempo when no tempo is at tick 0', () => {
    expect(factsOf(noTempo).notes.map((note) => note.t)).toEqual([0.5, 2]);
  });

  it('gives the same facts at the resolutions 192 and 480', () => {
    expect(factsOf(tempoChange480)).toEqual(factsOf(tempoChange));
  });

  it('sorts sections and events in the wrong order', () => {
    expect(factsOf(wrongOrder)).toEqual(factsOf(tempoChange));
  });

  it('reads a file with a byte order mark and CRLF line ends', () => {
    const windows = `\uFEFF${tempoChange.replaceAll('\n', '\r\n')}`;

    expect(factsOf(windows)).toEqual(factsOf(tempoChange));
  });
});

describe('readChart delay', () => {
  it('makes the notes and the beats later by the metadata delay', () => {
    const facts = factsOf(tempoChange, 500);

    expect(facts.notes.map((note) => note.t)).toEqual([2, 2.5, 3.5]);
    expect(facts.notes.map((note) => note.lenSec)).toEqual([1.5, 0, 1]);
    expect(facts.beats[0]?.t).toBe(0.5);
  });

  it('uses the chart Offset when the metadata delay is 0', () => {
    const facts = factsOf(offset);

    expect(facts.notes).toEqual([{ t: 0.75, frets: [0], lenSec: 0.25 }]);
    expect(facts.beats[0]?.t).toBe(0.25);
  });

  it('uses the metadata delay and not the chart Offset when the delay is not 0', () => {
    expect(factsOf(offset, -100).notes.map((note) => note.t)).toEqual([0.4]);
  });
});
