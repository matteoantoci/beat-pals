import { onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';

// The logo of the game: a glossy record with a face. The disc turns slowly; the face and the shine stay still.
// The wordmark is separate (TitleScreen). A 3-second hold on the logo opens the parent check (spec, "Screens").

/** A hold of this time on the logo opens the parent check. */
const HOLD_MS = 3000;

type Hold = {
  readonly down: JSX.EventHandler<SVGSVGElement, PointerEvent>;
  readonly stop: () => void;
};

/** The pointer handlers of the hold. A lift, a cancel, or a lost capture before HOLD_MS stops the hold. */
const holdOf = (onHold: () => void): Hold => {
  let timer: number | undefined;
  const stop = (): void => clearTimeout(timer);
  onCleanup(stop);
  const down: Hold['down'] = (event) => {
    stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    timer = window.setTimeout(onHold, HOLD_MS);
  };
  return { down, stop };
};

export const Logo = (props: { readonly onHold: () => void }): JSX.Element => {
  const hold = holdOf(() => props.onHold());
  return (
    <svg
      class="logo"
      viewBox="0 0 120 120"
      role="img"
      aria-label="Beat Pals"
      onPointerDown={hold.down}
      onPointerUp={hold.stop}
      onPointerCancel={hold.stop}
      onLostPointerCapture={hold.stop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <circle class="logo-shadow" cx="60" cy="64" r="56" />
      <g class="logo-disc">
        <circle class="logo-record" cx="60" cy="60" r="56" />
        <circle class="logo-groove" cx="60" cy="60" r="47" />
        <circle class="logo-groove" cx="60" cy="60" r="40" />
        <circle class="logo-groove" cx="60" cy="60" r="33" />
        <path class="logo-arc logo-arc-berry" d="M60 6 A54 54 0 0 1 98 22" />
        <path class="logo-arc logo-arc-mint" d="M60 114 A54 54 0 0 1 22 98" />
      </g>
      <circle class="logo-label" cx="60" cy="60" r="25" />
      <ellipse class="logo-eye" cx="52" cy="57" rx="5.5" ry="6.5" />
      <ellipse class="logo-eye" cx="68" cy="57" rx="5.5" ry="6.5" />
      <circle class="logo-pupil" cx="52.6" cy="57.8" r="3.3" />
      <circle class="logo-pupil" cx="68.6" cy="57.8" r="3.3" />
      <circle class="logo-eye" cx="53.8" cy="56.2" r="1.1" />
      <circle class="logo-eye" cx="69.8" cy="56.2" r="1.1" />
      <ellipse class="logo-cheek" cx="44" cy="66" rx="4" ry="2.5" />
      <ellipse class="logo-cheek" cx="76" cy="66" rx="4" ry="2.5" />
      <path class="logo-smile" d="M53 67 Q60 74 67 67" />
      <path class="logo-shine" d="M18 42 A46 46 0 0 1 42 16" />
    </svg>
  );
};
