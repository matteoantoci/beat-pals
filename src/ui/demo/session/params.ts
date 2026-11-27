// The query of the session demo route (spec, "Demo route"): `?session=<screen>&t=<sec>&sim&reduce`, for example
// `?session=night&t=2.4&sim`. `screen` is a name of the screen registry (./registry.ts). `t` is the scene time where
// the screen freezes (default 0). `sim` draws the iPhone 12 notch and home indicator with their safe areas, and
// `reduce` turns on reduced motion. The caller gives the screen names, so a new screen needs no change here.

import { readTime } from '../params';

export type SessionDemo = {
  readonly screen: string;
  readonly t: number;
  readonly sim: boolean;
  readonly reduce: boolean;
};

/** The session demo of the query string, or the reason why the query is wrong. */
export const readSessionDemo = (
  search: string,
  screens: readonly string[]
): { ok: true; demo: SessionDemo } | { ok: false; reason: string } => {
  const query = new URLSearchParams(search);
  const screen = query.get('session') ?? '';
  if (!screens.includes(screen)) {
    return { ok: false, reason: `session must be a screen of the list: ${screens.toSorted().join(', ')}.` };
  }
  const t = readTime(query.get('t'));
  if (!t.ok) {
    return t;
  }
  return { ok: true, demo: { screen, t: t.value, sim: query.has('sim'), reduce: query.has('reduce') } };
};
