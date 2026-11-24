import { describe, expect, it } from 'vitest';
import { readSongChart, type SongFacts } from '../index';
import { factsOf, META } from './fixtures/facts-of';
import { midFile, note, RES, TEMPO_TRACK, text, trackName } from './fixtures/mid';

/** 192 ticks for each beat at 120 BPM in 4/4: a beat is 0.5 s and a bar (768 ticks) is 2 s. */
const BAR = 768;

/** A .chart text with these lines in its sections, at 120 BPM in 4/4 with resolution 192. */
const chartText = (sections: Readonly<Record<string, readonly string[]>>): string =>
  [
    '[Song]\n{\n  Resolution = 192\n}',
    '[SyncTrack]\n{\n  0 = TS 4\n  0 = B 120000\n}',
    ...Object.entries(sections).map(
      ([name, lines]) => `[${name}]\n{\n${lines.map((line) => `  ${line}`).join('\n')}\n}`
    ),
  ].join('\n');

/** A green note on the downbeat of each bar from `from` to `to`. */
const barNotes = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, at) => `${String((from + at) * BAR)} = N 0 0`);

const phrasesOf = (facts: SongFacts) => ({ source: facts.phraseSource, phrases: facts.phrases });

describe('the phrases of a .chart file', () => {
  it('reads the Star Power phrases (S 2) of the lead guitar part, from their start up to before their end', () => {
    const chart = chartText({
      ExpertSingle: [...barNotes(0, 4), `${String(BAR)} = S 2 ${String(BAR)}`, `${String(BAR)} = S 64 96`],
      ExpertDrums: [`${String(3 * BAR)} = N 1 0`, `${String(3 * BAR)} = S 2 ${String(BAR)}`],
    });
    expect(phrasesOf(factsOf(chart))).toEqual({ source: 'chart', phrases: [{ t: 2, end: 4 }] });
  });

  it('takes the phrases of the difficulty that gives the guitar notes', () => {
    const chart = chartText({
      HardSingle: [...barNotes(0, 4), `${String(2 * BAR)} = S 2 ${String(BAR)}`],
      MediumSingle: [...barNotes(0, 4), `0 = S 2 ${String(BAR)}`],
    });
    expect(factsOf(chart).phrases).toEqual([{ t: 4, end: 6 }]);
  });

  it('keeps the earlier of 2 overlapping phrases, so phrases never overlap', () => {
    const chart = chartText({
      ExpertSingle: [
        ...barNotes(0, 4),
        `0 = S 2 ${String(BAR)}`,
        `${String(BAR / 2)} = S 2 ${String(BAR)}`,
        `${String(2 * BAR)} = S 2 ${String(BAR / 2)}`,
      ],
    });
    expect(factsOf(chart).phrases).toEqual([
      { t: 0, end: 2 },
      { t: 4, end: 5 },
    ]);
  });

  it('with no Star Power phrase, makes a phrase of 2 bars every 8 bars from the bar of the first note, skipping the first 8 bars', () => {
    const chart = chartText({ ExpertSingle: barNotes(2, 40) });
    expect(phrasesOf(factsOf(chart))).toEqual({
      source: 'fallback',
      phrases: [10, 18, 26, 34].map((bar) => ({ t: bar * 2, end: bar * 2 + 4 })),
    });
  });

  it('with no Star Power phrase and section markers, starts the phrases at sections at least 8 bars apart', () => {
    const marker = (bar: number, name: string, nudge = 0) => `${String(bar * BAR + nudge)} = E "section ${name}"`;
    const chart = chartText({
      Events: [
        marker(0, 'Intro'),
        marker(4, 'Verse 1'),
        marker(9, 'Chorus 1', 5),
        marker(12, 'Verse 2'),
        marker(17, 'Chorus 2', -5),
        marker(30, 'Outro'),
        `${String(20 * BAR)} = E "lyric la"`,
      ],
      ExpertSingle: barNotes(0, 40),
    });
    expect(factsOf(chart).phrases).toEqual([9, 17, 30].map((bar) => ({ t: bar * 2, end: bar * 2 + 4 })));
  });
});

const guitar = (...events: Parameters<typeof note>[]) => [
  trackName('PART GUITAR'),
  ...events.flatMap((args) => note(...args)),
];

const factsOfMid = (bytes: Uint8Array): SongFacts => {
  const result = readSongChart({ mid: bytes }, META);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.facts;
};

describe('the phrases of a .mid file', () => {
  /** A green note on each beat for 40 bars. */
  const beats = Array.from({ length: 160 }, (_, at): Parameters<typeof note> => [at * RES, 96]);
  const sections = [trackName('EVENTS'), text(0, '[section intro]'), text(12 * 4 * RES, '[prc_chorus_1]')];

  it('reads note 116 of PART GUITAR as Star Power phrases, and then ignores the section markers', () => {
    const mid = midFile([TEMPO_TRACK, guitar(...beats, [4 * RES, 116, 8 * RES]), sections]);
    expect(phrasesOf(factsOfMid(mid))).toEqual({ source: 'chart', phrases: [{ t: 2, end: 6 }] });
  });

  it('with no Star Power phrase, starts the phrases at the section markers of the EVENTS track', () => {
    const mid = midFile([TEMPO_TRACK, guitar(...beats), sections]);
    expect(phrasesOf(factsOfMid(mid))).toEqual({ source: 'fallback', phrases: [{ t: 24, end: 28 }] });
  });
});
