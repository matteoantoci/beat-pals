import { createSignal } from 'solid-js';
import { ParentArea } from './parent/ParentArea';
import { TitleScreen } from './title/TitleScreen';
import type { JSX } from 'solid-js';

// The screens of the app: the title screen and the parent area. The parent area opens from the title screen
// and goes back to it.

type Screen = 'title' | 'parent';

export const App = (): JSX.Element => {
  const [screen, setScreen] = createSignal<Screen>('title');
  return (
    <>
      {screen() === 'parent' ? (
        <ParentArea onClose={() => setScreen('title')} />
      ) : (
        <TitleScreen onParent={() => setScreen('parent')} />
      )}
    </>
  );
};
