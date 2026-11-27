import { onSettled } from 'solid-js';
import { NightStage, type NightMode } from '../../../night/NightStage';
import { decodePals, decodeSessionPals } from '../../../pals/pal-svg';
import { TitleToNight } from '../../../session/TitleToNight';
import type { SessionScreenProps, SessionScreens } from '../registry';
import type { JSX } from '@solidjs/web';

// The screens of the session end and start in the session demo (play-sessions spec, "Demo route"): `goodbye` (the
// goodbye scene), `night` (the night title while the rest time runs), `dawn` (the night title after the rest time,
// with the first light), `wake` (the wake-up scene after the first light), and `title-to-night` (the cross-fade of 2 s
// from the title to the night title, session-schedule spec, "Screens"). They show the stage of the scenes
// (src/ui/night/NightStage.tsx) with no sound, no timer, and no tap.

const stageScreen =
  (mode: NightMode, restTimeOver: boolean) =>
  (props: SessionScreenProps): JSX.Element => {
    let shown = false;
    let decoded = false;
    const ready = (): void => {
      if (shown && decoded) {
        props.ready();
      }
    };
    onSettled(() => {
      Promise.all([decodePals(), decodeSessionPals()]).then(() => {
        decoded = true;
        ready();
      }, reportError);
    });
    return (
      <NightStage
        mode={mode}
        reduce={props.reduce}
        restTimeOver={restTimeOver}
        onShown={() => {
          shown = true;
          ready();
        }}
      />
    );
  };

const Night = stageScreen('night', false);

export const screens: SessionScreens = {
  goodbye: stageScreen('goodbye', false),
  night: Night,
  dawn: stageScreen('night', true),
  wake: stageScreen('wake', true),
  'title-to-night': (props) => (
    <TitleToNight>
      <Night {...props} />
    </TitleToNight>
  ),
};
