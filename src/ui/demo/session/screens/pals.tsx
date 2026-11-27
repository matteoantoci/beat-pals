import { For, onSettled } from 'solid-js';
import { decodePals, decodeSessionPals, type PalFace, type PalIndex } from '../../../pals/pal-svg';
import { SessionPal } from '../../../pals/SessionPal';
import palsCss from './pals.css?inline';
import type { SessionScreenProps, SessionScreens } from '../registry';
import type { JSX } from '@solidjs/web';

// The `pals` screen of the session demo: the parts of the pals that only the session scenes use (play-sessions
// spec, "Screens and motion"). Each row is one pal. The columns show the arms, raised in the wave of the goodbye
// scene with the happy face; the yawn face with the arms in the stretch of the end-scene yawn; and the sleep face.
// The screen has no animation, so `t` and `reduce` change nothing.

type Column = { readonly name: string; readonly face: PalFace; readonly arms: 'up' | 'stretch' | 'none' };

const COLUMNS: readonly Column[] = [
  { name: 'Arms', face: 'happy', arms: 'up' },
  { name: 'Yawn', face: 'yawn', arms: 'stretch' },
  { name: 'Sleep', face: 'sleep', arms: 'none' },
];

const PALS: readonly PalIndex[] = [0, 1, 2];

const PalsScreen = (props: SessionScreenProps): JSX.Element => {
  onSettled(() => {
    Promise.all([decodePals(), decodeSessionPals()]).then(props.ready, reportError);
  });
  return (
    <main class="demo-pals">
      <style>{palsCss}</style>
      <For each={COLUMNS}>{(column) => <span class="demo-pals-name">{column.name}</span>}</For>
      <For each={PALS}>
        {(index) => (
          <For each={COLUMNS}>
            {(column) => (
              <span class={`demo-pals-spot demo-pals-${column.arms}`}>
                <SessionPal index={index} faces={[column.face]} />
              </span>
            )}
          </For>
        )}
      </For>
    </main>
  );
};

export const screens: SessionScreens = { pals: PalsScreen };
