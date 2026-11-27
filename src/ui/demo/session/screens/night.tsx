import { onSettled } from 'solid-js';
import { decodeSessionPals } from '../../../pals/pal-svg';
import { NightTitle } from '../../../title/NightTitle';
import type { SessionScreenProps, SessionScreens } from '../registry';
import type { JSX } from '@solidjs/web';

// The `night` and `dawn` screens of the session demo (play-sessions spec, "Demo route"): the night title while the
// rest time runs, and the night title after the rest time, with the lighter sky. A tap and the parent check change
// nothing here.

const nothing = (): void => undefined;

const nightScreen =
  (dawn: boolean) =>
  (props: SessionScreenProps): JSX.Element => {
    onSettled(() => {
      decodeSessionPals().then(props.ready, reportError);
    });
    return <NightTitle dawn={dawn} onWake={nothing} onParent={nothing} />;
  };

export const screens: SessionScreens = { night: nightScreen(false), dawn: nightScreen(true) };
