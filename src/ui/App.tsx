import { createSignal, Match, onCleanup, onMount, Switch } from 'solid-js';
import { savePlay } from '../shell/save';
import { keepSongsFresh } from '../shell/songs';
import { EndScene } from './end/EndScene';
import { ParentArea } from './parent/ParentArea';
import { PlayScreen } from './play/PlayScreen';
import { SongList, type SongChoice } from './songs/SongList';
import { TitleScreen } from './title/TitleScreen';
import type { PlayScore } from '../model';
import type { JSX } from 'solid-js';

// The screens of the app. A tap on the title screen opens the song list, and its home button goes back. A tap on a
// song card starts the play screen. The end of the song saves the play and shows the end scene, whose button goes
// back to the song list; home on the pause screen goes back to the song list with no result.
// The parent area opens from the title screen and goes back to it.

type Screen = 'title' | 'songs' | 'parent' | 'play' | 'end';

/** The play that the end scene shows. */
type Ended = { readonly choice: SongChoice; readonly ratio: number; readonly score: PlayScore };

export const App = (): JSX.Element => {
  // After the setup, the new songs download at the start and at each return to the app (spec, "Delivery").
  onMount(() => onCleanup(keepSongsFresh()));
  const [screen, setScreen] = createSignal<Screen>('title');
  /** The song of the play screen. */
  const [choice, setChoice] = createSignal<SongChoice>();
  const [ended, setEnded] = createSignal<Ended>();
  const play = (chosen: SongChoice): void => {
    setChoice(chosen);
    setScreen('play');
  };
  const end = (chosen: SongChoice, ratio: number | null): void => {
    if (ratio === null) {
      setScreen('songs');
      return;
    }
    setEnded({ choice: chosen, ratio, score: savePlay(chosen.song.id, ratio) });
    setScreen('end');
  };
  return (
    <Switch>
      <Match when={screen() === 'title'}>
        <TitleScreen onStart={() => setScreen('songs')} onParent={() => setScreen('parent')} />
      </Match>
      <Match when={screen() === 'songs'}>
        <SongList onHome={() => setScreen('title')} onPlay={play} />
      </Match>
      <Match when={screen() === 'parent'}>
        <ParentArea onClose={() => setScreen('title')} />
      </Match>
      <Match when={screen() === 'play' && choice()} keyed>
        {(chosen) => <PlayScreen choice={chosen} onEnd={(ratio) => end(chosen, ratio)} />}
      </Match>
      <Match when={screen() === 'end' && ended()} keyed>
        {(last) => <EndScene {...last} onDone={() => setScreen('songs')} />}
      </Match>
    </Switch>
  );
};
