import { createSignal, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';

// A button that acts only after a press of 0.6 s (spec, "Screens": pause and pause screen), so a child's tap does
// not stop the song or end the play. A ring fills around the button during the press. A lift, a cancel, or a lost
// pointer capture before the end stops the press, and the ring empties.

const HOLD_MS = 600;

type HoldButtonProps = {
  readonly class: string;
  readonly label: string;
  readonly onHold: () => void;
  readonly children: JSX.Element;
};

export const HoldButton = (props: HoldButtonProps): JSX.Element => {
  const [holding, setHolding] = createSignal(false);
  let timer: number | undefined;
  const stop = (): void => {
    clearTimeout(timer);
    setHolding(false);
  };
  onCleanup(stop);
  const down: JSX.EventHandler<HTMLButtonElement, PointerEvent> = (event) => {
    stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHolding(true);
    timer = window.setTimeout(() => {
      setHolding(false);
      props.onHold();
    }, HOLD_MS);
  };
  return (
    <button
      type="button"
      class={`hold-button ${props.class}`}
      classList={{ holding: holding() }}
      aria-label={props.label}
      onPointerDown={down}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg class="hold-ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle class="hold-track" cx="24" cy="24" r="22" />
        <circle class="hold-fill" cx="24" cy="24" r="22" pathLength="100" />
      </svg>
      {props.children}
    </button>
  );
};
