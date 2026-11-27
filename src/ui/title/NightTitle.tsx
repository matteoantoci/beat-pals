import { createSignal, onSettled, Show } from 'solid-js';
import { stopTitleMusic } from '../../sound';
import { NightStage } from '../night/NightStage';
import { ParentCheck } from '../parent/ParentCheck';
import { reducedMotion } from '../play/reduced-motion';
import { watchSafePoint } from './safe-point';
import type { JSX } from '@solidjs/web';

// The night title (play-sessions spec, "Night title and wake-up"): the title screen while the pals sleep. It shows
// stars, the moon, the logo with a sleeping face and a still record, the pals asleep under the blanket, and a "Zzz"
// (src/ui/night/NightStage.tsx), with no play button. It plays no title music: it stops the music that a hidden gap
// on the song list left on, and it does not use the tap of the normal title (./TitleScreen.tsx), which starts the
// music. While the rest time runs, a tap does nothing. When the rest time ends (`dawn`), the first light fades in
// behind the hill and the moon goes low, and only then does a tap wake the pals.
// The screen is a safe point for an app update (./safe-point.ts). A 3-second hold on the logo shows the parent check.

type NightTitleProps = {
  /** The rest time is over: the first light shows, and a tap wakes the pals. */
  readonly dawn: boolean;
  /** A tap after the rest time. */
  readonly onWake: () => void;
  /** The parent check is passed: open the parent area. */
  readonly onParent: () => void;
};

export const NightTitle = (props: NightTitleProps): JSX.Element => {
  onSettled(() => {
    stopTitleMusic();
    return watchSafePoint();
  });
  const [checking, setChecking] = createSignal(false);
  // While the parent check shows (also at the release of the logo hold), a tap belongs to the check.
  const tap = (): void => {
    if (props.dawn && !checking()) {
      props.onWake();
    }
  };
  return (
    <NightStage
      mode="night"
      reduce={reducedMotion()}
      firstLight={props.dawn}
      onLogoHold={() => setChecking(true)}
      onPointerUp={tap}
    >
      <Show when={checking()}>
        <ParentCheck onPass={() => props.onParent()} onClose={() => setChecking(false)} />
      </Show>
    </NightStage>
  );
};
