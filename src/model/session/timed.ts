// The changes of the session state by time alone (session-schedule spec, "Can a session start"): the end of the rest
// time, and the end of the last start time of the evening. The session controller sets one timer to the time of the
// next change, and at that time it asks the model again.

import { sessionAfter } from './session';
import { lastStartOf } from './time';
import type { SessionState, SessionTime, TimedChange } from './types';

/**
 * The next change of `state` by time alone after `now`, or null when no time alone changes it. Asleep: the end of
 * the rest time. Awake, when the parent did not open the session: the end of the last start time, from the current
 * `settings`, because a change of a setting applies from the next session start. Then a title-show puts the pals to
 * sleep until the next day start. An open session changes only by events.
 */
export const nextChange = (state: SessionState, { now, day, settings }: SessionTime): TimedChange | null => {
  if (state.kind === 'asleep') {
    return now < state.until ? { at: state.until, state } : null;
  }
  if (state.kind === 'open' || state.byParent) {
    return null;
  }
  // A session can start up to the last start time, so 1 ms after it is the first time with no start.
  const at = lastStartOf(day, settings) + 1;
  return now < at ? { at, state: sessionAfter(state, { type: 'title-show', now: at, day, settings }).state } : null;
};
