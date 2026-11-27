import { onSettled } from 'solid-js';
import { SongPicture } from '../songs/SongList';
import type { JSX } from '@solidjs/web';

// The disc of the load scene (spec, "Screens", load scene): the cover of her song on a turning record, with a fill
// ring around the record. The load scene and the last-song cue show it. The caller gives the share of the ring to
// fill at each time: the load fill, or for the cue the lower of the load fill and the time.

/** The share of the distance to the target that the ring moves in each frame, so a step never jumps. */
const EASE = 0.18;

type Ring = {
  readonly ring: SVGCircleElement;
  readonly fill: (now: number) => number;
  readonly stopped: () => boolean;
};

/** Moves the ring towards its fill in each frame. The ring never goes back, and it stops at a failure. `data-fill`
 * on the ring gives the fill in percent. Gives the function that stops the frames. */
const runRing = ({ ring, fill, stopped }: Ring): (() => void) => {
  let shown = 0;
  let frame = 0;
  const draw = (): void => {
    if (!stopped()) {
      const target = fill(performance.now());
      const next = shown + (target - shown) * EASE;
      shown = Math.max(shown, target - next < 0.002 ? target : next);
      ring.setAttribute('stroke-dasharray', `${(shown * 100).toFixed(2)} 100`);
      ring.setAttribute('data-fill', String(Math.round(shown * 100)));
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
};

type LoadDiscProps = {
  /** The cover picture of the song, or undefined for the plain card. */
  readonly picture: string | undefined;
  /** The share of the ring to fill (0 to 1) at the time `now` (ms, the clock of `performance.now()`). */
  readonly fill: (now: number) => number;
  readonly stopped: () => boolean;
};

/** The cover of the song on the turning record, with the fill ring around the record. */
export const LoadDisc = (props: LoadDiscProps): JSX.Element => {
  let ring: SVGCircleElement | undefined;
  onSettled(() => (ring ? runRing({ ring, fill: props.fill, stopped: props.stopped }) : undefined));
  return (
    <div class="load-disc">
      <svg viewBox="0 0 120 120">
        <circle class="logo-shadow" cx="60" cy="64" r="52" />
        <g class="load-record">
          <circle class="logo-record" cx="60" cy="60" r="52" />
          <circle class="logo-groove" cx="60" cy="60" r="45" />
          <circle class="logo-groove" cx="60" cy="60" r="39" />
          <path class="logo-arc logo-arc-berry" d="M60 10 A50 50 0 0 1 95 24" />
          <path class="logo-arc logo-arc-mint" d="M60 110 A50 50 0 0 1 25 96" />
        </g>
        <path class="logo-shine" d="M20 40 A44 44 0 0 1 40 18" />
        <circle class="load-ring-track" cx="60" cy="60" r="58" />
        <circle
          class="load-ring"
          cx="60"
          cy="60"
          r="58"
          pathLength="100"
          stroke-dasharray="0 100"
          ref={(el) => {
            ring = el;
          }}
        />
      </svg>
      <div class="load-cover">
        <SongPicture picture={props.picture} />
      </div>
    </div>
  );
};
