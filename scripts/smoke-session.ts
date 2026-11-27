// The play sessions in the smoke run (scripts/smoke.ts; play-sessions spec, "Testing Decisions", Seam 2). These steps
// run after the other online steps. They delete the session state before and after, so the other steps never meet a
// night title or a last song. Each step writes the state it needs (scripts/smoke-session-store.ts).
// - (a) An open session with its time used: the song list shows the sunset, the load scene of the next song has the
//   `data-last-song` mark and shows for at least 3.2 s, the end scene button "Goodbye" opens the goodbye scene with
//   the sun and the moon, and then the night title shows the pals asleep under the blanket, with no play button and
//   no title music. A tap on it does nothing.
// - (c) A session opens and a song plays for some seconds. At the hide, the state is written, and after a reload the
//   open session and its time used stay.
// - (d) An open session with its time used, and the load of the last song fails: the song list comes back, and the
//   session stays open with no record of the last song.
// - (b) Pals that sleep for 1 h more, and the wake-up scene; a tap after the rest time (./smoke-session-wake.ts).

import { check, setVisibility, shows, tap, wait } from './smoke-page.ts';
import { seedSession, sessionOf, usedUp } from './smoke-session-store.ts';
import { parentWake, tapWake } from './smoke-session-wake.ts';
import { cachedAgain, dropAudio } from './smoke-setup.ts';
import type { AudioRecord } from './smoke-audio.ts';
import type { Page } from 'puppeteer-core';

/** The test song lasts 15 s, and the load scene of the last song adds 3.2 s. */
const SONG_END_MS = 30_000;
/** The load scene of the last song shows for at least 3.2 s. */
const LAST_SONG_MS = 3200;
/** The end scene ignores taps for 2 s. */
const SKIP_AT_MS = 2200;
/** The goodbye scene lasts 7.6 s. */
const GOODBYE_MS = 7600;
/** The oops moment of a failed load lasts 1.5 s. */
const BACK_MS = 4000;
const CACHE = 'beat-pals-songs';
const DOWNLOAD_MS = 20_000;

/** From the title screen: the song list shows with the stage of the sun. */
const openList = async (page: Page, stage: string, name: string): Promise<boolean> => {
  await tap(page, '.title');
  const shown = await shows(page, `.song-list[data-sun-stage="${stage}"]`);
  check(`${name}: the song list shows the ${stage}`, shown);
  return shown && shows(page, '.song-card');
};

/** The end scene of the last song: after the skip, the button has the label "Goodbye". */
const goodbyeButton = async (page: Page): Promise<boolean> => {
  const shown = await shows(page, '.end', SONG_END_MS);
  check('last song: the end scene shows', shown);
  await wait(SKIP_AT_MS);
  await tap(page, '.end-foot');
  const button = await shows(page, '.end-done[aria-label="Goodbye"]', 1000);
  check('last song: the end scene button is "Goodbye"', button);
  return shown && button;
};

/** The load scene of the last song: it has the mark, and it shows for at least 3.2 s, also from the cache. */
const lastSongLoad = async (page: Page): Promise<void> => {
  await tap(page, '.song-cover');
  const tappedAt = Date.now();
  check('last song: the load scene has the data-last-song mark', await shows(page, '.load-scene[data-last-song]', 500));
  await wait(LAST_SONG_MS - 300 - (Date.now() - tappedAt));
  check('last song: the load scene shows for at least 3.2 s', (await page.$('.load-scene[data-last-song]')) !== null);
};

/** From the "Goodbye" button: the goodbye scene ignores taps, and the night title plays no title music. */
const goodbyeToNight = async (page: Page, audio: AudioRecord): Promise<void> => {
  await tap(page, '.end-done');
  check('Goodbye: the goodbye scene shows', await shows(page, '.goodbye', 1000));
  check(
    'goodbye scene: the sun sets and the moon rises',
    (await page.$('.goodbye .sun')) !== null && (await page.$('.goodbye .night-moon')) !== null
  );
  check('goodbye scene: the state is asleep', (await sessionOf(page)).kind === 'asleep');
  await tap(page, '.goodbye');
  check(
    'goodbye scene: a tap does nothing',
    (await page.$('.goodbye')) !== null && (await page.$('.song-list')) === null
  );
  check('goodbye scene: the night title shows at the end', await shows(page, '.night-title', GOODBYE_MS + 2000));
  // The goodbye tune rings out at the start of the night title, so the music count starts here.
  audio.reset();
  check(
    'night title: the pals sleep under the blanket',
    (await page.$$('.night-title .night-pal')).length === 3 && (await page.$('.night-title .night-blanket')) !== null
  );
  check('night title: no play button', (await page.$('.title-play')) === null);
  await tap(page, '.night-title');
  await wait(1500);
  check('night title: a tap before the end of the rest time does nothing', (await page.$('.night-title')) !== null);
  check('night title: no title music', audio.sources() === 0, `${String(audio.sources())} sources`);
};

/** (a) The last song, the goodbye scene, and the night title. */
const lastSong = async (page: Page, audio: AudioRecord, url: string): Promise<void> => {
  await seedSession(page, url, usedUp(Date.now()));
  if (!(await openList(page, 'sunset', 'used time'))) {
    return;
  }
  await lastSongLoad(page);
  if (await goodbyeButton(page)) {
    await goodbyeToNight(page, audio);
  }
};

/** (c) The write at the hide keeps the open session and its time used over a reload. */
const writeOnHide = async (page: Page, url: string): Promise<void> => {
  await seedSession(page, url, null);
  if (!(await openList(page, 'day', 'new session'))) {
    return;
  }
  await tap(page, '.song-cover');
  check('new session: the song plays', await shows(page, '.play:not(.play-loading)', 5000));
  await wait(3000);
  await page.evaluate(setVisibility, 'hidden');
  const hidden = await sessionOf(page);
  check(
    'hide: the open session and its time used are written',
    hidden.kind === 'open' && Number(hidden.usedMs) >= 3000 && typeof hidden.hiddenAt === 'number',
    JSON.stringify(hidden)
  );
  await page.reload({ waitUntil: 'networkidle2' });
  await tap(page, '.title');
  await shows(page, '.song-list');
  const after = await sessionOf(page);
  check(
    'reload after a hide: the open session and its time used stay',
    after.kind === 'open' && after.startedAt === hidden.startedAt && Number(after.usedMs) >= Number(hidden.usedMs),
    JSON.stringify(after)
  );
};

/** (d) A failed load of the last song goes back to the song list, and the session stays open. */
const lastSongLoadFailure = async (page: Page, url: string): Promise<void> => {
  await seedSession(page, url, usedUp(Date.now()));
  if (!(await openList(page, 'sunset', 'failed last song'))) {
    return;
  }
  const path = await page.evaluate(dropAudio, CACHE);
  await tap(page, '.song-cover');
  check('failed last song: the oops moment shows', await shows(page, '.load-scene[data-last-song].load-failed', 3000));
  check('failed last song: back to the song list', await shows(page, '.song-list', BACK_MS));
  const after = await sessionOf(page);
  check(
    'failed last song: the session stays open with no last song',
    after.kind === 'open' && after.lastSongAt === null,
    JSON.stringify(after)
  );
  // A return to the app downloads the file again, so the later steps have the song.
  await page.evaluate(setVisibility, 'hidden');
  await wait(300);
  await page.evaluate(setVisibility, 'visible');
  check('failed last song: a return downloads the file again', await cachedAgain(page, path, DOWNLOAD_MS));
};

/** The session steps, with no session state before and after them. */
export const sessionChecks = async (page: Page, audio: AudioRecord, url: string): Promise<void> => {
  await lastSong(page, audio, url);
  await writeOnHide(page, url);
  await lastSongLoadFailure(page, url);
  await parentWake(page, url);
  await tapWake(page, url);
  await seedSession(page, url, null);
  check('session steps: the session state is deleted', (await sessionOf(page)).kind === undefined);
};
