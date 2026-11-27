import { createSignal, For, Show } from 'solid-js';
import { SESSION_MINUTES, SESSIONS_PER_DAY } from '../../model';
import { planLine, statusLine } from './session-texts';
import type { SessionSettings, SessionStatus } from '../../model';
import type { JSX } from '@solidjs/web';

// The "Play sessions" section of the parent area (play-sessions spec, "Parent"), in the plain P14 style. It shows the
// state of the session with time spans only, the button "Open a new session now" while the pals sleep, the 2
// settings, and the calculated line. A change of a setting applies from the next session.

export type PlaySessionsProps = {
  /** The facts of the status line when the parent area opens. */
  readonly status: SessionStatus;
  readonly settings: SessionSettings;
  readonly onSettings: (settings: SessionSettings) => void;
  /** "Open a new session now": ends the sleep. The caller gives the status after it. */
  readonly onOpenNow: () => SessionStatus;
};

const Choice = <T extends number>(props: {
  readonly label: string;
  readonly items: readonly T[];
  readonly value: T;
  readonly onPick: (value: T) => void;
}): JSX.Element => (
  <div class="parent-choice" role="group" aria-label={props.label}>
    <For each={props.items}>
      {(item) => (
        <button type="button" aria-pressed={item === props.value ? 'true' : 'false'} onClick={() => props.onPick(item)}>
          {item}
        </button>
      )}
    </For>
  </div>
);

/** The 2 settings and the calculated line. The props give the start values. */
const SettingsPart = (props: {
  readonly settings: SessionSettings;
  readonly onSettings: (settings: SessionSettings) => void;
}): JSX.Element => {
  const [settings, setSettings] = createSignal(props.settings);
  const change = (next: SessionSettings): void => {
    setSettings(next);
    props.onSettings(next);
  };
  return (
    <>
      <h3>Minutes per session</h3>
      <Choice
        label="Minutes per session"
        items={SESSION_MINUTES}
        value={settings().minutes}
        onPick={(minutes) => change({ ...settings(), minutes })}
      />
      <p class="parent-hint">
        Time counts only while the game is on the screen. A song never stops in the middle, so a session can end a few
        minutes late.
      </p>
      <h3>Sessions per day</h3>
      <Choice
        label="Sessions per day"
        items={SESSIONS_PER_DAY}
        value={settings().perDay}
        onPick={(perDay) => change({ ...settings(), perDay })}
      />
      <p class="parent-hint">
        The game spaces the sessions evenly. In any 24 hours, at most this number of sessions starts.
      </p>
      <p class="play-sessions-plan">{planLine(settings())}</p>
      <p class="parent-hint">A change applies from the next session. A session that is open keeps its minutes.</p>
    </>
  );
};

export const PlaySessions = (props: PlaySessionsProps): JSX.Element => {
  // The prop gives the start value. "Open a new session now" gives the next status.
  const [status, setStatus] = createSignal(props.status);
  const asleep = (): boolean => status().kind === 'asleep' || status().kind === 'rest-time-over';
  return (
    <section class="parent-section play-sessions">
      <h2>Play sessions</h2>
      <p class="parent-status" role="status">
        {statusLine(status())}
      </p>
      <Show when={asleep()}>
        <>
          <button type="button" class="play-sessions-open" onClick={() => setStatus(props.onOpenNow())}>
            Open a new session now
          </button>
          <p class="parent-hint">
            The pals wake up on the title screen. This session does not count in the sessions per day.
          </p>
        </>
      </Show>
      <SettingsPart settings={props.settings} onSettings={props.onSettings} />
    </section>
  );
};
