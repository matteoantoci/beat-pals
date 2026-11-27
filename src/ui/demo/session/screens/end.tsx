import { onSettled, Show } from 'solid-js';
import { bandOf, type PlayOutcome } from '../../../../model';
import { DoneButton } from '../../../end/EndScene';
import { playScene } from '../../../end/motion';
import { Band, Sleeve, StarRow, type Refs } from '../../../end/parts';
import { sceneLength, type ScenePlan } from '../../../end/timeline';
import { decodePals, decodeSessionPals } from '../../../pals/pal-svg';
import type { Yawn } from '../../../end/yawn';
import type { SessionScreenProps, SessionScreens } from '../registry';
import type { JSX } from '@solidjs/web';

// The `end-afternoon` and `end-sunset` screens of the session demo: the end scene with the happy yawn (play-sessions
// spec, "Screens and motion"; sunset prototype, screens "End scene · tired" and "End scene · sunset"). The play
// earned the second star of a gold record, with no new color and no join, and the whole band dances. The screen uses
// the parts and the motion of the end scene, with no sound, no timer, and no tap, so it holds at `t`. The button
// shows from the end of the scene.

const OUTCOME: PlayOutcome = {
  before: { color: 3, stars: 1, weakPlays: 0 },
  after: { color: 3, stars: 2, weakPlays: 0 },
  star: 1,
  opened: null,
  joins: null,
};

const ignore = (): void => undefined;

const EndYawnScreen = (props: SessionScreenProps & { readonly yawn: Yawn }): JSX.Element => {
  const plan: ScenePlan = {
    star: OUTCOME.star,
    opened: false,
    joins: null,
    dance: 'band',
    band: bandOf('gold'),
    yawn: props.yawn,
  };
  const refs: Refs = { stars: [], bodies: [], pals: [] };
  onSettled(() => {
    const { root, cover, record, confetti } = refs;
    if (root === undefined || cover === undefined || record === undefined || confetti === undefined) {
      return;
    }
    const { newRecord, starSparks, landSparks, stars, bodies, pals } = refs;
    const parts = { root, cover, record, confetti, newRecord, starSparks, landSparks, stars, bodies, pals };
    playScene(parts, plan, props.reduce);
    Promise.all([decodePals(), decodeSessionPals()]).then(props.ready, reportError);
  });
  return (
    <main class="end" ref={(el) => Object.assign(refs, { root: el })}>
      <div class="end-confetti" ref={(el) => Object.assign(refs, { confetti: el })} aria-hidden="true" />
      <section class="end-info">
        <Sleeve outcome={OUTCOME} picture={undefined} refs={refs} />
        <StarRow outcome={OUTCOME} refs={refs} />
      </section>
      <Band plan={plan} refs={refs} />
      <div class="end-foot">
        <Show when={props.t >= sceneLength(plan)}>
          <DoneButton lastSong={false} onDone={ignore} />
        </Show>
      </div>
    </main>
  );
};

export const screens: SessionScreens = {
  'end-afternoon': (props) => <EndYawnScreen {...props} yawn="afternoon" />,
  'end-sunset': (props) => <EndYawnScreen {...props} yawn="sunset" />,
};
