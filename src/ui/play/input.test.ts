import { describe, expect, it } from 'vitest';
import { playOut } from '../../model/play/test-player';
import { laneAt, layout } from './geometry';
import { hitNote } from './hits';
import type { ChildChart, PlayEvent } from '../../model';

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const dotChart = (times: readonly number[]): ChildChart => ({
  band: [1],
  notes: times.map((t) => ({ t, lanes: [1], holdSec: 0 })),
});

const hitNotes = (chart: ChildChart, events: readonly PlayEvent[]): number[] =>
  events.flatMap((event) => (event.type === 'hit' ? [hitNote(chart, event)] : []));

describe('the tap columns', () => {
  // An iPhone 12 in portrait: 390 px wide, so the lanes are 124 px wide and Dot's lane runs from 133 to 257.
  const portrait = layout(390, 844, NO_INSETS);

  it('gives Pip the column from the left edge to Dot lane', () => {
    expect([0, 60, 132].map((x) => laneAt(portrait, x))).toStrictEqual([0, 0, 0]);
  });

  it('gives Dot its drawn lane', () => {
    expect([133, 195, 257].map((x) => laneAt(portrait, x))).toStrictEqual([1, 1, 1]);
  });

  it('gives Bo the column from Dot lane to the right edge', () => {
    expect([258, 330, 390].map((x) => laneAt(portrait, x))).toStrictEqual([2, 2, 2]);
  });
});

describe('the note of a hit', () => {
  it('is the tapped note for an early tap, a late tap, and a tap on time', () => {
    const chart = dotChart([1, 2, 3]);
    const offsets = [-0.2, 0.2, 0];
    const { events } = playOut(chart, { offset: (note) => offsets[note] ?? 0 });
    expect(hitNotes(chart, events)).toStrictEqual([0, 1, 2]);
  });

  it('is the earlier note for a late tap close to the next note', () => {
    const chart = dotChart([1, 1.5, 2]);
    const offsets = [0.2, null, -0.2];
    const { events } = playOut(chart, { offset: (note) => offsets[note] ?? null });
    expect(hitNotes(chart, events)).toStrictEqual([0, 2]);
  });
});
