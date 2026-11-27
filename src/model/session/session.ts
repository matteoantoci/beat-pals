// The session model (play-sessions spec, sections "Session rules" and "Session model", changed by the
// session-schedule spec). A session is the plays between a wake-up and the goodbye, with a time limit in minutes. A
// play day has a day budget in minutes, and a stop time in the evening. The caller gives the wall time on every event,
// and the play day of that time on the events that need it. The model never reads a clock or the local time.

import { budgetLeft, counted, lastStartOf, nextStage, stageOf, todayIn } from './time';
import { MINUTE_MS, SONG_ALLOWANCE_MS } from './types';
import type { Asleep, Open, PlayDay, SessionAnswer, SessionEvent, SessionState, SunStage } from './types';

/**
 * The asleep state after a session that ends at `endAt`, in the play day `day`. The pals sleep for the rest time
 * after the end. They sleep until the next day start when the day budget is used, or when the rest time ends after
 * the last start time. An end before the day start belongs to an earlier play day, whose next day start is not later
 * than the start of `day`: then the rest time is over at the start of `day`.
 */
const endOf = (open: Open, endAt: number, day: PlayDay): Asleep => {
  const today = todayIn(open.today, day);
  if (endAt < day.start) {
    return { kind: 'asleep', until: day.start, today };
  }
  const rested = endAt + open.settings.restMinutes * MINUTE_MS;
  const late = budgetLeft(today, open.settings) <= 0 || rested > lastStartOf(day, open.settings);
  return { kind: 'asleep', until: late ? day.next : rested, today };
};

/** The end of a session at a show: the asleep state when it has time used, else the awake state. */
const endAtShow = (open: Open, asleep: Asleep, byParent: boolean): SessionState =>
  open.usedMs > 0 ? asleep : { kind: 'awake', today: asleep.today, byParent };

/**
 * The gap rule at a show: the gap ends the session when `now` reaches the asleep-until of a goodbye at the hide. A
 * session with 0 used then turns awake, and a session of the parent keeps `byParent` in the same play day. When that
 * asleep-until is the next day start (the budget is used, or the stop time is near), a show in the same play day
 * keeps the session open. Then only a show at or after the stop time plus L ends a session that the parent did not
 * open, with asleep until the next day start.
 */
const afterGap = (open: Open, now: number, day: PlayDay): SessionState => {
  if (open.hiddenAt === null) {
    return open;
  }
  const end = endOf(open, open.hiddenAt, day);
  const sameDay = open.hiddenAt >= day.start;
  if (end.until !== day.next && now >= end.until) {
    return endAtShow(open, end, open.byParent && sameDay);
  }
  if (end.until === day.next && !open.byParent && now >= day.stop + SONG_ALLOWANCE_MS) {
    return endAtShow(open, end, false);
  }
  return { ...open, hiddenAt: null };
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
      return afterGap(open, event.now, event.day);
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
const listOpened = (open: Open, now: number, day: PlayDay): SessionAnswer => {
  const stage = nextStage(open, now, day);
  const step = stage === open.shownStage ? null : { from: open.shownStage, to: stage };
  return { state: { ...open, shownStage: stage, countingSince: open.countingSince ?? now }, step, last: false };
};

/**
 * A song start is the last song when the list shows the sunset, or when the time used reached the limit. For a
 * session that the parent did not open, also at or after the stop time.
 */
const songStarted = (open: Open, now: number, day: PlayDay): SessionAnswer => {
  const last = open.shownStage === 'sunset' || open.usedMs >= open.limitMs || (!open.byParent && now >= day.stop);
  return { state: last ? { ...open, lastSongAt: now } : open, step: null, last };
};

const openAfter = (open: Open, event: SessionEvent): SessionAnswer => {
  if (isCountEvent(event)) {
    return plain(countAfter(open, event));
  }
  switch (event.type) {
    case 'list-open':
      return listOpened(open, event.now, event.day);
    case 'song-start':
      return songStarted(open, event.now, event.day);
    case 'load-failed':
      return plain({ ...open, lastSongAt: null });
    case 'goodbye':
      return plain(endOf(open, event.now, event.day));
    case 'open-now':
    case 'wake-tap':
    case 'title-show':
      return plain(open);
    default: {
      // A new event must get its case above. This line keeps the switch complete.
      const unhandled: never = event;
      return unhandled;
    }
  }
};

type Awake = Extract<SessionState, { kind: 'awake' }>;

/**
 * A list-open in the awake state opens a session when the day budget has time left, and `now` is in the play day up
 * to the last start time. After "Open a new session now", it always opens a session. Else the pals sleep until the
 * next day start. A title-show applies the same conditions and opens no session. The limit of the new session is the
 * smaller of the minutes and the budget left, so the first list shows the sunset when little time is left.
 */
const awakeAfter = (awake: Awake, event: SessionEvent): SessionState => {
  if (event.type !== 'list-open' && event.type !== 'title-show') {
    return awake;
  }
  const { now, day, settings } = event;
  const today = todayIn(awake.today, day);
  const left = budgetLeft(today, settings);
  const canStart = left > 0 && now >= day.start && now <= lastStartOf(day, settings);
  if (!awake.byParent && !canStart) {
    return { kind: 'asleep', until: day.next, today };
  }
  if (event.type === 'title-show') {
    return awake;
  }
  const minutesMs = settings.minutes * MINUTE_MS;
  const open: Open = {
    kind: 'open',
    settings,
    limitMs: awake.byParent ? minutesMs : Math.min(minutesMs, left),
    byParent: awake.byParent,
    usedMs: 0,
    shownStage: 'day',
    countingSince: now,
    hiddenAt: null,
    lastSongAt: null,
    today,
  };
  return { ...open, shownStage: stageOf(open, now, day) };
};

/** The state and the answers after an event. An event that does not apply to the state changes nothing. */
export const sessionAfter = (state: SessionState, event: SessionEvent): SessionAnswer => {
  if (state.kind === 'open') {
    return openAfter(counted(state, event.now), event);
  }
  if (state.kind === 'awake') {
    return plain(awakeAfter(state, event));
  }
  if (event.type === 'open-now') {
    return plain({ kind: 'awake', today: todayIn(state.today, event.day), byParent: true });
  }
  if (event.type === 'wake-tap' && event.now >= state.until) {
    return plain({ kind: 'awake', today: todayIn(state.today, event.day), byParent: false });
  }
  return plain(state);
};

/** The stage at the end of a song: the stage that a list-open at `now` gives. Day when no session is open. */
export const endStage = (state: SessionState, now: number, day: PlayDay): SunStage =>
  state.kind === 'open' ? nextStage(counted(state, now), now, day) : 'day';

/** True when the pals sleep and the rest time is over: the night title shows first light, and a tap wakes them. */
export const restTimeOver = (state: SessionState, now: number): boolean =>
  state.kind === 'asleep' && now >= state.until;
