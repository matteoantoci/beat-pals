import { onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';

// The logo of the game: a record with eyes, and no text.
// A 3-second hold on the logo opens the parent check (spec, "Screens").

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
      <circle class="logo-record" cx="60" cy="60" r="56" />
      <circle class="logo-groove" cx="60" cy="60" r="44" />
      <circle class="logo-groove" cx="60" cy="60" r="34" />
      <circle class="logo-label" cx="60" cy="60" r="24" />
      <circle class="logo-eye" cx="52" cy="56" r="7" />
      <circle class="logo-eye" cx="68" cy="56" r="7" />
      <circle class="logo-pupil" cx="53" cy="57" r="3.5" />
      <circle class="logo-pupil" cx="69" cy="57" r="3.5" />
      <path class="logo-smile" d="M52 68 Q60 75 68 68" />
    </svg>
  );
};
