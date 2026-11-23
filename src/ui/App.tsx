import { createSignal, Match, Switch } from 'solid-js';
import { ParentArea } from './parent/ParentArea';
import { PlayScreen } from './play/PlayScreen';
import { SongList, type SongChoice } from './songs/SongList';
import { TitleScreen } from './title/TitleScreen';
import type { JSX } from 'solid-js';

// The screens of the app. A tap on the title screen opens the song list, and its home button goes back. A tap on a
// song card starts the play screen; the end of the song, or home on the pause screen, goes back to the song list.
// The parent area opens from the title screen and goes back to it.

type Screen = 'title' | 'songs' | 'parent' | 'play';

export const App = (): JSX.Element => {
  const [screen, setScreen] = createSignal<Screen>('title');
  /** The song of the play screen. */
  const [choice, setChoice] = createSignal<SongChoice>();
  const play = (chosen: SongChoice): void => {
    setChoice(chosen);
    setScreen('play');
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
        {(chosen) => <PlayScreen choice={chosen} onEnd={() => setScreen('songs')} />}
      </Match>
    </Switch>
  );
};
