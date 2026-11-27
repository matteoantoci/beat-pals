import { For } from 'solid-js';
import { armPicture, palFacePicture, type PalFace, type PalIndex } from './pal-svg';
import type { JSX } from '@solidjs/web';

// A pal of the session scenes (play-sessions spec, "Screens and motion"), built as in the sunset prototype: a body
// that moves, 2 arms behind it, and a stack of faces (src/ui/pals/session-pal.css). The first face of the stack
// shows, and the other faces wait at opacity 0: a scene changes the face when it fades one face over the other.
// The pictures share one outline, so the pal never turns see-through. The arms are hidden until a scene shows them,
// because an arm at rest points up behind the pal. A scene animates the parts through their classes:
// .session-pal (the body), .session-pal-arm-left and .session-pal-arm-right, .session-pal-stack, and
// .session-pal-face with its data-face.
// The parent of a session pal is a positioned box with the size of the pal.

export const SessionPal = (props: { readonly index: PalIndex; readonly faces: readonly PalFace[] }): JSX.Element => (
  <span class="session-pal">
    <img class="session-pal-arm session-pal-arm-left" src={armPicture(props.index)} alt="" draggable="false" />
    <img class="session-pal-arm session-pal-arm-right" src={armPicture(props.index)} alt="" draggable="false" />
    <span class="session-pal-stack">
      <For each={props.faces}>
        {(face) => (
          <img
            class="session-pal-face"
            data-face={face}
            src={palFacePicture(props.index, face)}
            alt=""
            draggable="false"
          />
        )}
      </For>
    </span>
  </span>
);
