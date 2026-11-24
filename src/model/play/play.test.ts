import { describe, expect, it } from 'vitest';
import { apply, result, startPlay } from '../index';
import { playActions, playOut } from './test-player';
import type { Action, ChildChart, Lane, PlayEvent } from '../index';

/** A child chart with a plain note in `lane` at each time. All 3 pals are in the band unless `band` says else. */
const chartOf = (
  times: readonly number[],
  { lane = 1, band = [0, 1, 2], phrases = [] }: { lane?: Lane; band?: Lane[]; phrases?: ChildChart['phrases'] } = {}
): ChildChart => ({
  band,
  notes: times.map((t) => ({ t, lanes: [lane], holdSec: 0 })),
  phrases,
});

/** `count` notes 0.5 s apart from 2 s on: each good window is 0.225 s (45% of the gap). */
const steady = (count: number): ChildChart => chartOf(Array.from({ length: count }, (_, at) => 2 + at / 2));

/** The events as short lines, so a test can show the whole story of a play. */
const story = (events: readonly PlayEvent[]): string[] =>
  events.map((event) => {
    switch (event.type) {
      case 'hit':
        return `hit ${event.lane} ${event.grade} at ${event.soundAt}`;
      case 'hop':
        return `hop ${event.lane}`;
      case 'faded':
      case 'holdDone':
        return `${event.type} ${event.note}`;
      case 'energy':
        return `energy ${event.step}`;
      case 'starMoment':
        return `star moment ${event.phrase}`;
      default: {
        const unhandled: never = event;
        return unhandled;
      }
    }
  });

/** The energy lines of a play. */
const energySteps = (events: readonly PlayEvent[]): string[] =>
  story(events).filter((line) => line.startsWith('energy'));

/** The offsets that tap the notes at these indexes on time and miss all others. */
const tapOnly =
  (...hit: number[]) =>
  (note: number): number | null =>
    hit.includes(note) ? 0 : null;

/** The indexes from `from` to `to - 1`. */
const range = (from: number, to: number): number[] => Array.from({ length: to - from }, (_, at) => from + at);

describe('apply: hits', () => {
  it('hits each note that is tapped on time as great, with the clap at the note time', () => {
    const played = playOut(chartOf([2, 3, 4]));
    expect(story(played.events)).toEqual(['hit 1 great at 2', 'hit 1 great at 3', 'hit 1 great at 4']);
    expect(result(played.end)).toBe(1);
  });

  it('grades a tap great within 100 ms and good within 250 ms, and schedules the clap of an early tap', () => {
    const offsets = [-0.0625, 0.09375, -0.125, 0.25, 0.28125];
    const played = playOut(chartOf([2, 3, 4, 5, 6]), { offset: (note) => offsets[note] ?? null });
    expect(story(played.events)).toEqual([
      'hit 1 great at 2',
      'hit 1 great at 3.09375',
      'hit 1 good at 4',
      'hit 1 good at 5.25',
      'energy 1',
      'faded 4',
    ]);
    expect(result(played.end)).toBe(0.8);
  });

  it('caps the good window at 45% of the gap to the next note', () => {
    // The notes are 0.5 s apart, so each good window is 0.225 s.
    const offsets = [0.21875, 0.234375, 0];
    const played = playOut(chartOf([2, 2.5, 3]), { offset: (note) => offsets[note] ?? null });
    expect(story(played.events)).toEqual(['hit 1 good at 2.21875', 'faded 1', 'hit 1 great at 3']);
  });

  it('hits the nearest open note in the lane', () => {
    const extra = [
      { t: 2.1875, lane: 1 },
      { t: 2.3125, lane: 1 },
    ] as const;
    const played = playOut(chartOf([2, 2.5]), { offset: () => null, extra });
    // The first tap is nearer to the note at 2 s. The second tap is nearer to it too, but that note is hit.
    expect(story(played.events)).toEqual(['hit 1 good at 2.1875', 'hit 1 good at 2.5']);
    expect(result(played.end)).toBe(1);
  });

  it('does not hit a note in another lane', () => {
    const played = playOut(chartOf([2], { lane: 2 }), { offset: () => null, extra: [{ t: 2, lane: 1 }] });
    expect(story(played.events)).toEqual(['faded 0']);
    expect(result(played.end)).toBe(0);
  });

  it('counts a second contact in a lane as no tap until the first contact is up', () => {
    const actions: Action[] = [
      { type: 'press', t: 2, lane: 1, pointerId: 1 },
      { type: 'press', t: 2.9375, lane: 1, pointerId: 2 },
      { type: 'release', t: 2.96875, pointerId: 1 },
      { type: 'release', t: 2.96875, pointerId: 2 },
      { type: 'press', t: 3.0625, lane: 1, pointerId: 3 },
      { type: 'advance', t: 4 },
    ];
    const played = playActions(startPlay(chartOf([2, 3])), actions);
    // Without the rule, the second contact would hit the note at 3 s early, and the clap would be at 3.
    expect(story(played.events)).toEqual(['hit 1 great at 2', 'hit 1 great at 3.0625']);
  });

  it('makes a waiting pal hop at a tap in its lane, and does not judge that tap', () => {
    const chart = chartOf([2, 3], { band: [1] });
    const extra = [
      { t: 2, lane: 0 },
      { t: 2.5, lane: 2 },
    ] as const;
    const played = playOut(chart, { offset: tapOnly(1), extra });
    expect(story(played.events)).toEqual(['hop 0', 'faded 0', 'hop 2', 'hit 1 great at 3']);
    expect(result(played.end)).toBe(0.5);
  });

  it('gives no event and no penalty for an extra tap', () => {
    const extra = [
      { t: 2.5, lane: 1 },
      { t: 3.5, lane: 0 },
    ] as const;
    const played = playOut(chartOf([2, 3, 4]), { extra });
    expect(story(played.events)).toEqual(['hit 1 great at 2', 'hit 1 great at 3', 'hit 1 great at 4']);
    expect(result(played.end)).toBe(1);
  });

  it('fades each note with no hit and gives the hit ratio', () => {
    const played = playOut(chartOf([2, 3, 4, 5]), { offset: tapOnly(0, 2) });
    expect(story(played.events)).toEqual(['hit 1 great at 2', 'faded 1', 'hit 1 great at 4', 'faded 3']);
    expect(result(played.end)).toBe(0.5);
  });

  it('takes a song time that steps back after a resume with no harm', () => {
    const actions: Action[] = [
      { type: 'advance', t: 2.5 },
      { type: 'advance', t: 2.4 },
      { type: 'advance', t: 2.5 },
      { type: 'press', t: 2.9375, lane: 1, pointerId: 1 },
      { type: 'advance', t: 4 },
    ];
    const played = playActions(startPlay(chartOf([2, 3])), actions);
    expect(story(played.events)).toEqual(['faded 0', 'hit 1 great at 3']);
  });
});

/** The note index of each hit. */
const hitNotes = (events: readonly PlayEvent[]): number[] =>
  events.flatMap((event) => (event.type === 'hit' ? [event.note] : []));

describe('apply: the note of a hit', () => {
  it('is the tapped note for an early tap, a late tap, and a tap on time', () => {
    const offsets = [-0.2, 0.2, 0];
    const played = playOut(chartOf([1, 2, 3]), { offset: (note) => offsets[note] ?? 0 });
    expect(hitNotes(played.events)).toEqual([0, 1, 2]);
  });

  it('is the earlier note for a late tap close to the next note', () => {
    const offsets = [0.2, null, -0.2];
    const played = playOut(chartOf([1, 1.5, 2]), { offset: (note) => offsets[note] ?? null });
    expect(hitNotes(played.events)).toEqual([0, 2]);
  });
});

describe('apply: band energy', () => {
  it('goes up to steps 1, 2, 3, and gold at 4, 8, 16, and 30 hits', () => {
    const lines = story(playOut(steady(30)).events);
    const hitsBefore = lines.flatMap((line, at) =>
      line.startsWith('energy')
        ? [`${line} after ${lines.slice(0, at).filter((before) => before.startsWith('hit')).length} hits`]
        : []
    );
    expect(hitsBefore).toEqual([
      'energy 1 after 4 hits',
      'energy 2 after 8 hits',
      'energy 3 after 16 hits',
      'energy gold after 30 hits',
    ]);
  });

  it('drops one step at a passed note 1.8 s after the first passed note of the run', () => {
    // The notes are 0.5 s apart, so the fifth passed note is 2 s after the first one.
    const played = playOut(steady(14), { offset: tapOnly(...range(0, 8)) });
    expect(story(played.events).slice(-7)).toEqual([
      'faded 8',
      'faded 9',
      'faded 10',
      'faded 11',
      'faded 12',
      'energy 1',
      'faded 13',
    ]);
  });

  it('restarts the points at the threshold of the lower step after a drop', () => {
    // Step 2 after 8 hits, a drop to step 1, then 4 hits reach 8 points again.
    const played = playOut(steady(18), { offset: tapOnly(...range(0, 8), ...range(14, 18)) });
    expect(energySteps(played.events)).toEqual(['energy 1', 'energy 2', 'energy 1', 'energy 2']);
  });

  it('drops only one step for each run, also when many notes pass in one advance', () => {
    // Step 3 after 16 hits, then 20 passed notes in one advance at the end.
    const played = playOut(steady(36), { offset: tapOnly(...range(0, 16)) });
    const lines = story(played.events).slice(-23);
    expect(lines.filter((line) => line.startsWith('energy'))).toEqual(['energy 2', 'energy 1', 'energy 0']);
    expect(lines.indexOf('energy 2')).toBe(5);
    expect(lines.indexOf('energy 1')).toBe(11);
    expect(lines.indexOf('energy 0')).toBe(17);
  });

  it('clears the run of passed notes at a hit', () => {
    // 3 passed notes, a hit, and 3 passed notes: each run lasts 1 s.
    const played = playOut(steady(11), { offset: tapOnly(0, 1, 2, 3, 7) });
    expect(energySteps(played.events)).toEqual(['energy 1']);
  });

  it('stays in a gap with no notes and drops at the next passed note', () => {
    const chart = chartOf([2, 2.5, 3, 3.5, 4, 10]);
    const start = playOut(chart, { offset: tapOnly(0, 1, 2, 3) });
    expect(story(start.events).slice(-4)).toEqual(['energy 1', 'faded 4', 'faded 5', 'energy 0']);
    // The same taps, with the song time stopped in the gap.
    const inGap = playActions(startPlay(chart), [
      ...[2, 2.5, 3, 3.5].flatMap((t, pointerId): Action[] => [
        { type: 'press', t, lane: 1, pointerId },
        { type: 'release', t: t + 0.0625, pointerId },
      ]),
      { type: 'advance', t: 9.5 },
    ]);
    expect(story(inGap.events).slice(-2)).toEqual(['energy 1', 'faded 4']);
    expect(energySteps(inGap.events)).toEqual(['energy 1']);
  });
});

/** The star moment lines of a play. */
const stars = (events: readonly PlayEvent[]): string[] =>
  story(events).filter((line) => line.startsWith('star moment'));

/** The line before each star moment, with no energy lines. */
const beforeStars = (events: readonly PlayEvent[]): string[] => {
  const lines = story(events).filter((line) => !line.startsWith('energy'));
  return lines.flatMap((line, at) => (line.startsWith('star moment') ? [lines[at - 1] ?? ''] : []));
};

describe('apply: star moments', () => {
  /** 14 notes 1 s apart from 2 s on: a phrase of 8 notes (2 to 9) and a phrase of 4 notes (10 to 13). */
  const chart = chartOf(
    range(0, 14).map((at) => 2 + at),
    {
      phrases: [
        { first: 2, last: 9 },
        { first: 10, last: 13 },
      ],
    }
  );

  it('gives a star moment at the hit of the last note of a phrase when 6 of its 8 notes were hit', () => {
    const played = playOut(chart, { offset: tapOnly(0, 1, 2, 4, 6, 7, 8, 9) });
    expect(stars(played.events)).toEqual(['star moment 0']);
    expect(beforeStars(played.events)).toEqual(['hit 1 great at 11']);
  });

  it('gives no star moment when 5 of its 8 notes were hit, and no other event changes', () => {
    const played = playOut(chart, { offset: tapOnly(0, 1, 2, 4, 7, 8, 9) });
    expect(stars(played.events)).toEqual([]);
    expect(result(played.end)).toBe(7 / 14);
  });

  it('gives the star moment when the missed last note of the phrase passes', () => {
    const played = playOut(chart, { offset: tapOnly(2, 3, 4, 5, 6, 7, 8) });
    expect(stars(played.events)).toEqual(['star moment 0']);
    expect(beforeStars(played.events)).toEqual(['faded 9']);
  });

  it('counts only the notes of the phrase: 3 of 4 is enough, 2 of 4 is not', () => {
    const enough = playOut(chart, { offset: tapOnly(10, 11, 13) });
    expect(stars(enough.events)).toEqual(['star moment 1']);
    const short = playOut(chart, { offset: tapOnly(...range(0, 10), 10, 13) });
    expect(stars(short.events)).toEqual(['star moment 0']);
  });

  it('gives each phrase its own star moment, one time', () => {
    expect(stars(playOut(chart).events)).toEqual(['star moment 0', 'star moment 1']);
  });
});

describe('apply: quit', () => {
  it('ends the play with no result, and the play changes nothing after it', () => {
    const chart = chartOf([2, 3]);
    const played = playActions(startPlay(chart), [{ type: 'press', t: 2, lane: 1, pointerId: 1 }, { type: 'quit' }]);
    expect(result(played.end)).toBeNull();
    const after = apply(played.end, { type: 'press', t: 3, lane: 1, pointerId: 2 });
    expect(after).toEqual({ state: played.end, events: [] });
    expect(apply(played.end, { type: 'advance', t: 5 }).state).toBe(played.end);
  });
});
