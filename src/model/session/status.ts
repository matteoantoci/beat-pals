// The facts of the status line of the parent area (session-schedule spec, "Parent area"): the minutes used today,
// the minutes of the open session, or the time that the pals still sleep.

import { counted, todayIn } from './time';
import { MINUTE_MS } from './types';
import type { SessionState, SessionStatus, SessionTime } from './types';

/**
 * The facts of the status line at `now`, in the play day `day`. The day budget comes from the settings of the open
 * session, or from the current `settings` while no session is open.
 */
export const parentStatus = (state: SessionState, { now, day, settings }: SessionTime): SessionStatus => {
  if (state.kind === 'asleep') {
    return now >= state.until
      ? { kind: 'rest-time-over' }
      : {
          kind: 'asleep',
          minutesLeft: Math.ceil((state.until - now) / MINUTE_MS),
          untilDayStart: state.until === day.next,
        };
  }
  const current = state.kind === 'open' ? counted(state, now) : state;
  const usedTodayMinutes = Math.floor(todayIn(current.today, day).usedMs / MINUTE_MS);
  if (current.kind === 'awake') {
    return { kind: 'awake', usedTodayMinutes, dayMinutes: settings.dayMinutes, byParent: current.byParent };
  }
  return {
    kind: 'open',
    usedTodayMinutes,
    dayMinutes: current.settings.dayMinutes,
    byParent: current.byParent,
    usedMinutes: Math.floor(current.usedMs / MINUTE_MS),
    limitMinutes: Math.ceil(current.limitMs / MINUTE_MS),
  };
};
