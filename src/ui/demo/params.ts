// The query of the demo route (spec, "Testing Decisions"): `?demo=<color>.<stars>&energy=<step>&t=<sec>&sim&reduce`,
// for example `?demo=gold.1&energy=3&t=2.4&sim`. The record color and its stars give the play setup, as the
// progress of a song does. `energy` sets the band energy step (0 to 3, or gold); without it, the screen shows the
// energy that the play reached. `t` is the song time where the screen freezes (default 0). `sim` draws the iPhone 12
// notch and home indicator with their safe areas, and `reduce` turns on reduced motion. `nostar` shows the same frame
// with no star moment: the reference frame of the flash area measure (C11) of the star moment burst.

import { RECORD_COLORS } from '../../model';
import type { EnergyStep, SongProgress } from '../../model';

export type Demo = {
  readonly progress: SongProgress;
  readonly energy: EnergyStep | undefined;
  readonly t: number;
  readonly sim: boolean;
  readonly reduce: boolean;
  readonly nostar: boolean;
};

type Read<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

const STARS: Readonly<Record<string, SongProgress['stars']>> = { 0: 0, 1: 1, 2: 2, 3: 3 };
const COLORS: Readonly<Record<string, SongProgress['color']>> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};
const ENERGY: Readonly<Record<string, EnergyStep>> = { 0: 0, 1: 1, 2: 2, 3: 3, gold: 'gold' };

const lookUp = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

const readProgress = (text: string): Read<SongProgress> => {
  const [colorName = '', starText = ''] = text.split('.');
  const color = lookUp(COLORS, colorName);
  const stars = lookUp(STARS, starText);
  return color === undefined || stars === undefined
    ? { ok: false, reason: `demo must be <color>.<stars>: a color of ${RECORD_COLORS.join(', ')}, and 0 to 3 stars.` }
    : { ok: true, value: { color, stars, weakPlays: 0 } };
};

const readEnergy = (text: string | null): Read<EnergyStep | undefined> => {
  const energy = text === null ? undefined : lookUp(ENERGY, text);
  return text !== null && energy === undefined
    ? { ok: false, reason: 'energy must be 0, 1, 2, 3, or gold.' }
    : { ok: true, value: energy };
};

/** The time `t` where the screen freezes, in seconds (default 0). The session demo also reads it. */
export const readTime = (text: string | null): Read<number> => {
  const t = Number(text ?? '0');
  return Number.isFinite(t) && t >= 0
    ? { ok: true, value: t }
    : { ok: false, reason: 't must be a time in seconds, 0 or more.' };
};

/** The demo of the query string, or the reason why the query is wrong. */
export const readDemo = (search: string): { ok: true; demo: Demo } | { ok: false; reason: string } => {
  const query = new URLSearchParams(search);
  const progress = readProgress(query.get('demo') ?? '');
  if (!progress.ok) {
    return progress;
  }
  const energy = readEnergy(query.get('energy'));
  if (!energy.ok) {
    return energy;
  }
  const t = readTime(query.get('t'));
  if (!t.ok) {
    return t;
  }
  const flags = { sim: query.has('sim'), reduce: query.has('reduce'), nostar: query.has('nostar') };
  return { ok: true, demo: { progress: progress.value, energy: energy.value, t: t.value, ...flags } };
};
