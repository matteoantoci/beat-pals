// The session model (spec "Play sessions", sections "Session rules" and "Session model"). A session is the plays
// between a wake-up and the goodbye, with a time limit in minutes. The caller gives the wall time on every event, and
// the model never reads a clock.

import { DAY_MS, MINUTE_MS, SONG_ALLOWANCE_MS, WAKING_DAY_MS } from './types';
import type { Asleep, Open, SessionAnswer, SessionEvent, SessionState, SessionStatus, SunStage } from './types';

/** One counted step over this time counts 0: the clock jumped forward. */
const MAX_STEP_MS = MINUTE_MS;

const STAGES: readonly SunStage[] = ['day', 'afternoon', 'sunset'];

/** Adds the counted time from `countingSince` to `now`. A negative step and a step over 60 s count 0. */
const counted = (open: Open, now: number): Open => {
  if (open.countingSince === null) {
    return open;
  }
  const step = now - open.countingSince;
  const add = step >= 0 && step <= MAX_STEP_MS ? step : 0;
  return { ...open, usedMs: open.usedMs + add, countingSince: now };
};

/** The time limit of the session in ms. */
const limitOf = (open: Open): number => open.settings.minutes * MINUTE_MS;

/** The stage that the time used gives: sunset when the next song can reach the limit. */
const stageOf = (open: Open): SunStage => {
  const limitMs = limitOf(open);
  if (open.usedMs + SONG_ALLOWANCE_MS > limitMs || open.usedMs >= limitMs) {
    return 'sunset';
  }
  return open.usedMs >= limitMs / 3 ? 'afternoon' : 'day';
};

/** The stage of the next list-open. The shown stage never goes back inside a session. */
const nextStage = (open: Open): SunStage => {
  const stage = stageOf(open);
  return STAGES.indexOf(stage) > STAGES.indexOf(open.shownStage) ? stage : open.shownStage;
};

/**
 * The asleep state after a session that ends at `endAt`. The start of the session joins the stored starts when it
 * counts: a session with 0 used and a session that the parent opened do not count. The pals sleep until the later of
 * the session start plus the spacing and the end. When the 24 h before the end hold `perDay` starts or more, they
 * sleep at least until enough of them leave the window.
 */
const endOf = (open: Open, endAt: number): Asleep => {
  const counts = open.usedMs > 0 && !open.byParent;
  const starts = [...open.starts, ...(counts ? [open.startedAt] : [])]
    .filter((start) => start > endAt - DAY_MS)
    .toSorted((a, b) => a - b);
  const spaced = Math.max(open.startedAt + WAKING_DAY_MS / open.settings.perDay, endAt);
  const leaves = starts[starts.length - open.settings.perDay];
  return { kind: 'asleep', until: leaves === undefined ? spaced : Math.max(spaced, leaves + DAY_MS), starts };
};

/**
 * The gap rule at a show: the gap ends the session when `now` reaches the asleep-until of a goodbye at the hide.
 * Then a session with time used turns asleep, with the rest time over, and a session with 0 used turns awake. A
 * session with 0 used after "Open a new session now" keeps `byParent`, so the next session also stays out of the cap.
 */
const afterGap = (open: Open, now: number): SessionState => {
  if (open.hiddenAt === null) {
    return open;
  }
  const end = endOf(open, open.hiddenAt);
  if (now < end.until) {
    return { ...open, hiddenAt: null };
  }
  return open.usedMs > 0 ? end : { kind: 'awake', starts: end.starts, byParent: open.byParent };
};

/** The events of the count and of the page visibility. */
type CountEvent = Extract<SessionEvent, { type: 'count-start' | 'count-stop' | 'tick' | 'hide' | 'show' }>;

const COUNT_EVENTS: ReadonlySet<SessionEvent['type']> = new Set(['count-start', 'count-stop', 'tick', 'hide', 'show']);

const isCountEvent = (event: SessionEvent): event is CountEvent => COUNT_EVENTS.has(event.type);

/** The state of an open session after an event of the count or of the page visibility. */
const countAfter = (open: Open, event: CountEvent): SessionState => {
  switch (event.type) {
    case 'count-start':
      return open.hiddenAt === null ? { ...open, countingSince: event.now } : open;
    case 'count-stop':
      return { ...open, countingSince: null };
    case 'tick':
      return open;
    case 'hide':
      return { ...open, countingSince: null, hiddenAt: event.now };
    case 'show':
      return afterGap(open, event.now);
    default: {
      // A new count event must get its case above. This line keeps the switch complete.
      const unhandled: never = event;
      return unhandled;
    }
  }
};

/** An answer with no step and no last song. */
const plain = (state: SessionState): SessionAnswer => ({ state, step: null, last: false });

/** The list-open sets the shown stage. It also starts the count, because the song list counts. */
const listOpened = (open: Open, now: number): SessionAnswer => {
  const stage = nextStage(open);
  const step = stage === open.shownStage ? null : { from: open.shownStage, to: stage };
  return { state: { ...open, shownStage: stage, countingSince: open.countingSince ?? now }, step, last: false };
};

/** A song start is the last song when the list shows the sunset, or when the time used reached the limit. */
const songStarted = (open: Open, now: number): SessionAnswer => {
  const last = open.shownStage === 'sunset' || open.usedMs >= limitOf(open);
  return { state: last ? { ...open, lastSongAt: now } : open, step: null, last };
};

const openAfter = (open: Open, event: SessionEvent): SessionAnswer => {
  if (isCountEvent(event)) {
    return plain(countAfter(open, event));
  }
  switch (event.type) {
    case 'list-open':
      return listOpened(open, event.now);
    case 'song-start':
      return songStarted(open, event.now);
    case 'load-failed':
      return plain({ ...open, lastSongAt: null });
    case 'goodbye':
      return plain(endOf(open, event.now));
    case 'open-now':
    case 'wake-tap':
      return plain(open);
    default: {
      // A new event must get its case above. This line keeps the switch complete.
      const unhandled: never = event;
      return unhandled;
    }
  }
};

/** The state and the answers after an event. An event that does not apply to the state changes nothing. */
export const sessionAfter = (state: SessionState, event: SessionEvent): SessionAnswer => {
  if (state.kind === 'open') {
    return openAfter(counted(state, event.now), event);
  }
  if (state.kind === 'awake' && event.type === 'list-open') {
    return plain({
      kind: 'open',
      settings: event.settings,
      startedAt: event.now,
      byParent: state.byParent,
      usedMs: 0,
      shownStage: 'day',
      countingSince: event.now,
      hiddenAt: null,
      lastSongAt: null,
      starts: state.starts,
    });
  }
  if (state.kind === 'asleep' && event.type === 'open-now') {
    return plain({ kind: 'awake', starts: state.starts, byParent: true });
  }
  if (state.kind === 'asleep' && event.type === 'wake-tap' && event.now >= state.until) {
    return plain({ kind: 'awake', starts: state.starts, byParent: false });
  }
  return plain(state);
};

/** The stage at the end of a song: the stage that a list-open at `now` gives. Day when no session is open. */
export const endStage = (state: SessionState, now: number): SunStage =>
  state.kind === 'open' ? nextStage(counted(state, now)) : 'day';

/** True when the pals sleep and the rest time is over: the night title shows first light, and a tap wakes them. */
export const restOver = (state: SessionState, now: number): boolean => state.kind === 'asleep' && now >= state.until;

/** The facts of the status line of the parent area: the whole minutes used, or the minutes that the pals still sleep. */
export const parentStatus = (state: SessionState, now: number): SessionStatus => {
  if (state.kind === 'awake') {
    return { kind: 'awake' };
  }
  if (state.kind === 'open') {
    const usedMinutes = Math.floor(counted(state, now).usedMs / MINUTE_MS);
    return { kind: 'open', usedMinutes, limitMinutes: state.settings.minutes };
  }
  return now >= state.until
    ? { kind: 'rest-over' }
    : { kind: 'asleep', minutesLeft: Math.ceil((state.until - now) / MINUTE_MS) };
};
