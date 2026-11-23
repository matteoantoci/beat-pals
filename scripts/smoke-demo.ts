// The demo route in the smoke build (spec, "Testing Decisions"): `?demo=<color>.<stars>&energy=<step>&t=<sec>&sim&reduce`
// freezes the play screen of the demo song. The smoke checks that the route loads. SMOKE_DEMO_SHOTS=<folder> also
// saves the screenshots of the checklist C1 to C30 there: each record color, each energy step, a held soft hold, and
// reduced motion, in portrait and in landscape on the simulated iPhone 12.

import { join } from 'node:path';
import { check, shows, wait } from './smoke-page.ts';
import type { Browser, Page } from 'puppeteer-core';

const SHOTS = process.env['SMOKE_DEMO_SHOTS'];
const READY_MS = 10_000;
/** The pal pictures decode before the frame; this gives the browser time to paint them. */
const PAINT_MS = 300;

/** The iPhone 12 screen in CSS px. */
const SIZES = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } } as const;

// The times in the demo song (src/ui/demo/demo.chart): a note at 14.0 s in each color (a double from platinum up),
// and at platinum a soft hold from 15.0 s and a double at 14.0 s.
/** 0.1 s after the hit at 14.0 s; a soft hold and plain notes are on the way. */
const T_HIT = 14.1;
/** 0.3 s after the hit at 14.0 s. */
const T_LATER = 14.3;
/** 1.2 s after the bronze hit at 12.0 s, before the next bronze note at 14.0 s: no hit effect may show. */
const T_GONE = 13.2;
/** The platinum double at 14.0 s is on the way. */
const T_DOUBLE = 12.6;
/** In the middle of a soft hold. */
const T_HELD = 15.3;

type Shot = { readonly name: string; readonly query: string };
/** One screenshot: the demo, the folder, and the screen size. */
type ShotPlace = { readonly shot: Shot; readonly folder: string; readonly size: keyof typeof SIZES };

const COLOR_SHOTS: readonly Shot[] = ['bronze.0', 'silver.1', 'gold.1', 'platinum.1', 'diamond.2'].map((record) => ({
  name: `color-${record.split('.')[0] ?? record}`,
  query: `demo=${record}&energy=0&t=${String(T_HIT)}&sim`,
}));

const ENERGY_SHOTS: readonly Shot[] = ['0', '1', '2', '3', 'gold'].map((step) => ({
  name: `energy-${step}`,
  query: `demo=platinum.1&energy=${step}&t=${String(T_HIT)}&sim`,
}));

/** The level-up moments of a perfect platinum play, 0.2 s after each step up, with the energy of the play (no energy in the query). */
const LEVEL_UP_SHOTS: readonly Shot[] = [
  { step: '1', at: 4.2 },
  { step: '2', at: 8.2 },
  { step: '3', at: 16.2 },
  { step: 'gold', at: 30.7 },
].map(({ step, at }) => ({ name: `level-up-${step}`, query: `demo=platinum.1&t=${String(at)}&sim` }));

const OTHER_SHOTS: readonly Shot[] = [
  { name: 'hit-later-platinum', query: `demo=platinum.1&energy=0&t=${String(T_LATER)}&sim` },
  { name: 'hit-gone-bronze', query: `demo=bronze.0&energy=0&t=${String(T_GONE)}&sim` },
  { name: 'double-platinum', query: `demo=platinum.1&energy=0&t=${String(T_DOUBLE)}&sim` },
  { name: 'held-platinum', query: `demo=platinum.1&energy=2&t=${String(T_HELD)}&sim` },
  { name: 'reduce-diamond', query: `demo=diamond.2&energy=gold&t=${String(T_HIT)}&sim&reduce` },
  { name: 'reduce-later-diamond', query: `demo=diamond.2&energy=gold&t=${String(T_LATER)}&sim&reduce` },
];

const open = async (page: Page, url: string, query: string): Promise<boolean> => {
  await page.goto(`${url}?${query}`, { waitUntil: 'load' });
  return shows(page, '[data-demo-ready]', READY_MS);
};

/** One screenshot of the demo route, at one size. */
const saveShot = async (page: Page, url: string, { shot: { name, query }, folder, size }: ShotPlace): Promise<void> => {
  await page.setViewport({ ...SIZES[size], isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const ready = await open(page, url, query);
  await wait(PAINT_MS);
  await page.screenshot({ path: join(folder, `${name}-${size}.png`) });
  check(`demo shot ${name}-${size}`, ready);
};

/** The screenshots, one after the other: the page shows one demo at a time. */
const saveShots = async (page: Page, url: string, folder: string): Promise<void> => {
  const shots = (['portrait', 'landscape'] as const).flatMap((size) =>
    [...COLOR_SHOTS, ...ENERGY_SHOTS, ...LEVEL_UP_SHOTS, ...OTHER_SHOTS].map((shot) => ({ shot, folder, size }))
  );
  await shots.reduce(async (done, shot) => {
    await done;
    await saveShot(page, url, shot);
  }, Promise.resolve());
};

/** The route loads and freezes, and a wrong query shows its reason. */
const routeChecks = async (page: Page, url: string): Promise<void> => {
  await page.setViewport({ ...SIZES.portrait, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const ready = await open(page, url, `demo=gold.1&energy=2&t=${String(T_HIT)}&sim`);
  const pals = await page.$$eval('.play-pal:not([hidden])', (images) => images.length);
  check('demo route: the frozen play screen shows', ready && pals === 3, `${String(pals)} pals`);
  await page.goto(`${url}?demo=copper.9`, { waitUntil: 'load' });
  check('demo route: a wrong query shows its reason', await shows(page, '.demo-failure', READY_MS));
};

/** The demo route checks, and the screenshots when the run has a folder for them (SMOKE_DEMO_SHOTS). */
export const demoChecks = async (browser: Browser, url: string): Promise<void> => {
  const page = await browser.newPage();
  try {
    await routeChecks(page, url);
    await (SHOTS === undefined ? Promise.resolve() : saveShots(page, url, SHOTS));
  } finally {
    await page.close();
  }
};
