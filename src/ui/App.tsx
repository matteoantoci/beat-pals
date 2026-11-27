import { createSignal, Match, onSettled, Switch } from 'solid-js';
import { endStage } from '../model';
import { savePlay } from '../shell/save';
import { keepSongsFresh } from '../shell/songs';
import { EndScene } from './end/EndScene';
import { ParentArea } from './parent/ParentArea';
import { PlayScreen } from './play/PlayScreen';
import { GoodbyeScene } from './session/GoodbyeScene';
import { Title, wakeRoutes } from './session/TitleRoute';
import { SongList, type SongChoice, type SunView } from './songs/SongList';
import type { PlayOutcome, SunStage } from '../model';
import type { PlayResult } from './play/play-load';
import type { SessionController } from './session/controller';
import type { JSX } from '@solidjs/web';
import type { Accessor } from 'solid-js';

// The screens of the app. A tap on the title screen opens the song list, and its home button goes back. A tap on a
// song card starts the play screen. The end of the song saves the play and shows the end scene, whose button goes
// back to the song list; home on the pause screen and a failed load go back to the song list with no result.
// The parent area opens from the title screen and goes back to it.
// Play sessions (play-sessions spec, "Session rules"): each open of the song list gives the stage of the sun, and
// each song start asks the session if it is the last song. After the last song, the end scene button and home on the
// pause screen open the goodbye scene, and then the title screen shows the night title while the pals sleep. The
// wake-up scene plays at a tap on the night title after the rest time. It also plays when the parent area closes
// after "Open a new session now". Then the normal title shows, and the title music starts. The time counts on the
// song list, the play screen (with the load scene and the pause screen), and the end scene. When a hidden gap ends
// the session on one of these screens, the title screen shows.

type Screen = 'title' | 'songs' | 'parent' | 'play' | 'end' | 'goodbye';

/** The screens where the time of the session counts. */
const COUNTED: Readonly<Record<Screen, boolean>> = {
  title: false,
  songs: true,
  parent: false,
  play: true,
  end: true,
  goodbye: false,
};

/** The song of the play screen. */
type Playing = { readonly choice: SongChoice; readonly lastSong: boolean };

/** The play that the end scene shows, with the stage of the sun at the end of the song. */
type Ended = Playing & { readonly score: number; readonly outcome: PlayOutcome; readonly stage: SunStage };

/** Saves the play, and gives what the end scene shows. */
const endedOf = (current: Playing, score: number, session: SessionController): Ended => ({
  ...current,
  score,
  outcome: savePlay(current.choice.song.id, score),
  stage: endStage(session.state(), session.now()),
});

type Routes = {
  /** The screen that shows: the title screen when the session ended on a counted screen (a hidden gap). */
  readonly shown: Accessor<Screen>;
  readonly sun: Accessor<SunView>;
  readonly playing: Accessor<Playing | undefined>;
  readonly ended: Accessor<Ended | undefined>;
  readonly go: (next: Screen) => void;
  readonly openList: () => void;
  readonly play: (choice: SongChoice) => void;
  /** The end scene button: the goodbye scene after the last song, else the song list. */
  readonly done: (lastSong: boolean) => void;
  readonly end: (current: Playing, result: PlayResult) => void;
};

/** The screen of the app and the moves between the screens, with the events of the session. */
const appRoutes = (session: SessionController): Routes => {
  const [screen, setScreen] = createSignal<Screen>('title');
  const [sun, setSun] = createSignal<SunView>({ stage: 'day', step: null });
  const [playing, setPlaying] = createSignal<Playing>();
  const [ended, setEnded] = createSignal<Ended>();
  const go = (next: Screen): void => {
    session.count(COUNTED[next]);
    setScreen(next);
  };
  const openList = (): void => {
    const { state, step } = session.send('list-open');
    setSun({ stage: state.kind === 'open' ? state.shownStage : 'day', step });
    go('songs');
  };
  // The goodbye event fires at the start of the goodbye scene, and the state turns asleep then.
  const done = (lastSong: boolean): void => {
    if (lastSong) {
      session.send('goodbye');
      go('goodbye');
      return;
    }
    openList();
  };
  const end = (current: Playing, result: PlayResult): void => {
    if (result.kind === 'score') {
      setEnded(endedOf(current, result.score, session));
      go('end');
      return;
    }
    // A failed load goes back to the song list, and the session stays open. The title music comes back there.
    if (result.kind === 'failed') {
      session.send('load-failed');
    }
    done(result.kind === 'home' && current.lastSong);
  };
  return {
    shown: () => (COUNTED[screen()] && session.state().kind !== 'open' ? 'title' : screen()),
    sun,
    playing,
    ended,
    go,
    openList,
    play: (choice) => {
      setPlaying({ choice, lastSong: session.send('song-start').last });
      go('play');
    },
    done,
    end,
  };
};

export const App = (props: { readonly session: SessionController }): JSX.Element => {
  const { session } = props;
  // After the setup, the new songs download at the start and at each return to the app (spec, "Delivery").
  onSettled(keepSongsFresh);
  const { shown, sun, playing, ended, go, openList, play, done, end } = appRoutes(session);
  const wakes = wakeRoutes(session, go);
  return (
    <Switch>
      <Match when={shown() === 'title'}>
        <Title session={session} routes={wakes} onStart={openList} />
      </Match>
      <Match when={shown() === 'songs'}>
        <SongList sun={sun()} onHome={() => go('title')} onPlay={play} />
      </Match>
      <Match when={shown() === 'parent'}>
        <ParentArea session={session} onClose={wakes.closeParent} />
      </Match>
      <Match when={shown() === 'play' && playing()} keyed>
        {(current) => (
          <PlayScreen choice={current.choice} lastSong={current.lastSong} onEnd={(result) => end(current, result)} />
        )}
      </Match>
      <Match when={shown() === 'end' && ended()} keyed>
        {(last) => <EndScene {...last} onDone={() => done(last.lastSong)} />}
      </Match>
      <Match when={shown() === 'goodbye'}>
        <GoodbyeScene onDone={() => go('title')} />
      </Match>
    </Switch>
  );
};
