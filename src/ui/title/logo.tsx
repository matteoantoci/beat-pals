import { For, onCleanup } from 'solid-js';
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

/** The paint of a part of the face: a class of the logo (title.css), or a fill colour. */
type Paint = { readonly class: string } | { readonly fill: string };

/** The places of the 2 eyes of the face. The faces of the sun use them too (src/ui/sun/Sun.tsx). */
export const EYES_X = [52, 68] as const;

/** The smile of the open face. The happy face of the sun has it too (src/ui/sun/Sun.tsx). */
export const OPEN_SMILE = 'M53 67 Q60 74 67 67';

/** The open eyes of the logo face: white eyes, dark pupils, and a white glint. The happy face of the sun has them too
 * (src/ui/sun/Sun.tsx). */
export const OpenEyes = (props: { readonly white: Paint; readonly dark: Paint }): JSX.Element => (
  <For each={EYES_X}>
    {(x) => (
      <>
        <ellipse cx={x} cy="57" rx="5.5" ry="6.5" {...props.white} />
        <circle cx={x + 0.6} cy="57.8" r="3.3" {...props.dark} />
        <circle cx={x + 1.8} cy="56.2" r="1.1" {...props.white} />
      </>
    )}
  </For>
);

/** The open eyes and the smile. With `sleepy`, they wait at opacity 0, so the wake-up scene can open them. */
const AwakeFace = (props: { readonly sleepy: boolean }): JSX.Element => (
  <g data-part="logo-awake" style={props.sleepy ? { opacity: 0 } : undefined}>
    <OpenEyes white={{ class: 'logo-eye' }} dark={{ class: 'logo-pupil' }} />
    <path class="logo-smile" d={OPEN_SMILE} />
  </g>
);

/** The face of the night title (play-sessions spec): closed eyes and a small smile. */
const AsleepFace = (): JSX.Element => (
  <g data-part="logo-asleep">
    <path class="logo-smile" d="M46.5 56.5 q5.5 5.5 11 0" />
    <path class="logo-smile" d="M62.5 56.5 q5.5 5.5 11 0" />
    <path class="logo-smile" d="M55.5 68 Q60 71 64.5 68" />
  </g>
);

/** `sleepy` gives the asleep face (night title, goodbye, and wake-up). With no `onHold`, a hold does nothing (the
 * goodbye and the wake-up scenes). */
export const Logo = (props: { readonly onHold?: (() => void) | undefined; readonly sleepy?: boolean }): JSX.Element => {
  const hold = holdOf(() => props.onHold?.());
  const down: Hold['down'] = (event) => {
    if (props.onHold) {
      hold.down(event);
    }
  };
  return (
    <svg
      class="logo"
      viewBox="0 0 120 120"
      role="img"
      aria-label="Beat Pals"
      onPointerDown={down}
      onPointerUp={hold.stop}
      onPointerCancel={hold.stop}
      onLostPointerCapture={hold.stop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <circle class="logo-shadow" cx="60" cy="64" r="56" />
      <g class="logo-disc" data-part="logo-disc">
        <circle class="logo-record" cx="60" cy="60" r="56" />
        <circle class="logo-groove" cx="60" cy="60" r="47" />
        <circle class="logo-groove" cx="60" cy="60" r="40" />
        <circle class="logo-groove" cx="60" cy="60" r="33" />
        <path class="logo-arc logo-arc-berry" d="M60 6 A54 54 0 0 1 98 22" />
        <path class="logo-arc logo-arc-mint" d="M60 114 A54 54 0 0 1 22 98" />
      </g>
      <circle class="logo-label" data-part="logo-label" cx="60" cy="60" r="25" />
      <ellipse class="logo-cheek" cx="44" cy="66" rx="4" ry="2.5" />
      <ellipse class="logo-cheek" cx="76" cy="66" rx="4" ry="2.5" />
      <AwakeFace sleepy={props.sleepy ?? false} />
      {props.sleepy ? <AsleepFace /> : undefined}
      <path class="logo-shine" d="M18 42 A46 46 0 0 1 42 16" />
    </svg>
  );
};
