// Browser smoke run of the built app: `pnpm smoke`. It is a dev tool, not a test of the game model.
// The `smoke` script in package.json runs `vite build` first. This file serves dist/ with `vite preview` through
// portless, under a name unique to the run, so 2 checkouts can run it at the same time.
// Chromium cannot show the iOS audio rules (see the Pile Pals docs/agents/ios-device.md), so a pass here does not
// prove the iPhone behaviour. It uses the default install of Google Chrome on macOS.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { launch } from 'puppeteer-core';
import { recordAudio } from './smoke-audio.ts';
import { tap, wait } from './smoke-page.ts';
import type { AudioRecord } from './smoke-audio.ts';
import type { ChildProcess } from 'node:child_process';
import type { Browser, Page } from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const NAME = `bp-smoke-${String(process.pid)}`;
const READY_MS = 30_000;

type Server = { readonly url: string; readonly child: ChildProcess };

/**
 * Starts `vite preview` through portless. portless gives the port in $PORT. The shell prints it before vite starts,
 * and the script waits until vite prints its URL.
 */
const startPreview = async (): Promise<Server> => {
  const child = spawn(
    'portless',
    [
      NAME,
      'sh',
      '-c',
      'echo "smoke-port=$PORT"; exec node_modules/.bin/vite preview --host 127.0.0.1 --port "$PORT" --strictPort',
    ],
    { stdio: ['ignore', 'pipe', 'inherit'], detached: true }
  );
  const lines = createInterface({ input: child.stdout });
  const ready = Promise.withResolvers<string>();
  let port = '';
  lines.on('line', (line) => {
    port = /smoke-port=(\d+)/u.exec(line)?.[1] ?? port;
    if (port && line.includes('Local:')) {
      ready.resolve(port);
    }
  });
  child.on('exit', () => ready.reject(new Error('portless did not start vite preview.')));
  const timer = setTimeout(() => child.kill(), READY_MS);
  await ready.promise.finally(() => clearTimeout(timer));
  return { url: `http://127.0.0.1:${port}/beat-pals/`, child };
};

/** Stops portless and vite: the whole process group. */
const stopPreview = async ({ child }: Server): Promise<void> => {
  if (child.pid === undefined || child.exitCode !== null) {
    return;
  }
  process.kill(-child.pid, 'SIGTERM');
  await once(child, 'exit');
};

/**
 * Puppeteer refuses to emulate display-mode, so the page gets the standalone signs of an iPhone home screen app:
 * `navigator.standalone` and a `matchMedia` that matches `(display-mode: standalone)`.
 */
const standalone = (): void => {
  Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
  const original = globalThis.matchMedia.bind(globalThis);
  globalThis.matchMedia = (query: string): MediaQueryList => {
    const list = original(query);
    if (!query.includes('display-mode')) {
      return list;
    }
    return Object.defineProperty(list, 'matches', { value: query.includes('standalone') });
  };
};

const results: string[] = [];
const check = (name: string, pass: boolean, detail = ''): void => {
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const titleTap = async (page: Page, audio: AudioRecord): Promise<void> => {
  check('standalone display mode', await page.evaluate(() => matchMedia('(display-mode: standalone)').matches));
  check('title screen shows the logo', (await page.$('.title .logo')) !== null);
  audio.reset();
  await tap(page, '.title');
  await wait(1500);
  check('title tap: context runs', audio.contexts().endsWith('running'), audio.contexts());
  check('title tap: music plays', audio.sources() > 0, `${String(audio.sources())} sources`);
};

const setVisibility = (state: string): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

/** A trip to the background marks the context stale. The next tap replaces it, and the title music starts again. */
const titleAfterBackground = async (page: Page, audio: AudioRecord): Promise<void> => {
  await page.evaluate(setVisibility, 'hidden');
  await wait(300);
  await page.evaluate(setVisibility, 'visible');
  await wait(300);
  audio.reset();
  await tap(page, '.title');
  await wait(1500);
  const states = audio.contexts();
  check('background trip: tap replaces the context', states.includes('closed') && states.includes('new'), states);
  check('background trip: new context runs', states.includes('running'), states);
  check('background trip: music plays again', audio.sources() > 0, `${String(audio.sources())} sources`);
};

/** Taps the digits on the pad of the parent check, one after the other. Digit 0 is button 11 of the pad. */
const typeDigits = async (page: Page, digits: string): Promise<void> => {
  const [digit] = digits;
  if (digit === undefined) {
    return;
  }
  await tap(page, `.parent-pad button:nth-child(${digit === '0' ? '11' : digit})`);
  await wait(150);
  await typeDigits(page, digits.slice(1));
};

/** A press of 3.2 s on the logo opens the parent check. The right answer opens the parent area. */
const parentCheck = async (page: Page): Promise<void> => {
  const box = await (await page.$('.logo'))?.boundingBox();
  if (!box) {
    check('parent check: logo shows', false);
    return;
  }
  await page.touchscreen.touchStart(box.x + box.width / 2, box.y + box.height / 2);
  await wait(3200);
  await page.touchscreen.touchEnd();
  check('logo hold: parent check shows', (await page.$('.parent-check')) !== null);
  const answer = await page.$eval('.parent-problem', (el) => {
    const [left = 0, right = 0] = (el.textContent.match(/\d+/gu) ?? []).map(Number);
    return String(left * right);
  });
  await wait(300);
  check(
    'hold release: answer field is empty',
    (await page.$eval('.parent-problem output', (el) => el.textContent)) === '?'
  );
  await typeDigits(page, answer);
  await tap(page, '.parent-ok');
  await wait(300);
  check('right answer: parent area shows', (await page.$('.parent-area')) !== null);
  await tap(page, '.parent-bar button');
  await wait(300);
  check('Done: title screen shows', (await page.$('.title .logo')) !== null);
};

const runAll = async (browser: Browser, url: string): Promise<void> => {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 763, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(standalone);
  const audio = await recordAudio(await page.createCDPSession());
  await page.goto(url, { waitUntil: 'networkidle2' });
  await titleTap(page, audio);
  await titleAfterBackground(page, audio);
  await parentCheck(page);
};

const smoke = async (url: string): Promise<void> => {
  const browser = await launch({ executablePath: CHROME, headless: true });
  try {
    await runAll(browser, url);
  } finally {
    await browser.close();
  }
};

const server = await startPreview();
try {
  await smoke(server.url);
} finally {
  await stopPreview(server);
}

console.log(results.join('\n'));
const failures = results.filter((line) => line.startsWith('FAIL'));
if (failures.length > 0) {
  throw new Error(`${String(failures.length)} smoke checks failed.`);
}
