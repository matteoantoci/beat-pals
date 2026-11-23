import { createSignal, Match, Switch } from 'solid-js';
import { ParentArea } from './parent/ParentArea';
import { SongList } from './songs/SongList';
import { TitleScreen } from './title/TitleScreen';
import type { JSX } from 'solid-js';

// The screens of the app. A tap on the title screen opens the song list, and its home button goes back. The parent
// area opens from the title screen and goes back to it.

type Screen = 'title' | 'songs' | 'parent';

export const App = (): JSX.Element => {
  const [screen, setScreen] = createSignal<Screen>('title');
  return (
    <Switch>
      <Match when={screen() === 'title'}>
        <TitleScreen onStart={() => setScreen('songs')} onParent={() => setScreen('parent')} />
      </Match>
      <Match when={screen() === 'songs'}>
        <SongList onHome={() => setScreen('title')} />
      </Match>
      <Match when={screen() === 'parent'}>
        <ParentArea onClose={() => setScreen('title')} />
      </Match>
    </Switch>
  );
};
