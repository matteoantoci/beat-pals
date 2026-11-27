import { createSignal, For, Show } from 'solid-js';
import { DAY_MINUTES, REST_MINUTES, SESSION_MINUTES, STOP_MINUTES } from '../../model';
import { clockText, planLine, spanText, statusLine } from './session-texts';
import type { SessionSettings, SessionStatus } from '../../model';
import type { JSX } from '@solidjs/web';

// The "Play sessions" section of the parent area (session-schedule spec, "Parent area"), in the plain P14 style. It
// shows the state of the session, the button "Open a new session now" while the pals sleep, the 4 settings, and the
// calculated line. A change of a setting applies from the next session.

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
  /** The text of a choice. Without it, the choice shows its number. */
  readonly text?: (value: T) => string;
}): JSX.Element => (
  <div class="parent-choice" role="group" aria-label={props.label}>
    <For each={props.items}>
      {(item) => (
        <button type="button" aria-pressed={item === props.value ? 'true' : 'false'} onClick={() => props.onPick(item)}>
          {props.text ? props.text(item) : item}
        </button>
      )}
    </For>
  </div>
);

/** The rest time and the stop time, with their notes. */
const ClockChoices = (props: {
  readonly settings: SessionSettings;
  readonly change: (next: SessionSettings) => void;
}): JSX.Element => (
  <>
    <h3>Rest time</h3>
    <Choice
      label="Rest time"
      items={REST_MINUTES}
      value={props.settings.restMinutes}
      onPick={(restMinutes) => props.change({ ...props.settings, restMinutes })}
      text={spanText}
    />
    <p class="parent-hint">The shortest time from the goodbye to the next session.</p>
    <h3>Stop time</h3>
    <Choice
      label="Stop time"
      items={STOP_MINUTES}
      value={props.settings.stopMinutes}
      onPick={(stopMinutes) => props.change({ ...props.settings, stopMinutes })}
      text={clockText}
    />
    <p class="parent-hint">
      No new session starts after the stop time minus the minutes per session. At the stop time, the next song is the
      last song.
    </p>
  </>
);

/** The 4 settings and the calculated line. The props give the start values. */
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
      <h3>Minutes per day</h3>
      <Choice
        label="Minutes per day"
        items={DAY_MINUTES}
        value={settings().dayMinutes}
        onPick={(dayMinutes) => change({ ...settings(), dayMinutes })}
      />
      <p class="parent-hint">The play time of all sessions in a day. A new day starts at 5:00.</p>
      <ClockChoices settings={settings()} change={change} />
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
            The pals wake up on the title screen, also after the stop time and when the minutes per day are used. This
            session does not use the minutes per day.
          </p>
        </>
      </Show>
      <SettingsPart settings={props.settings} onSettings={props.onSettings} />
    </section>
  );
};
