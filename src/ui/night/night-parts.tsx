import { For } from 'solid-js';
import { PULSE_AT } from './wake';
import type { JSX } from '@solidjs/web';

// The drawn parts of the night stage (./NightStage.tsx), as in the sunset prototype: the stars, the moon, the blanket,
// the "Zzz", and the play button of the wake-up scene. The colours are in ./night-stage.css.

/** The stars of the night sky, in % of the sky: [x, y, size in px]. */
const STARS: readonly (readonly [number, number, number])[] = [
  [6, 10, 3],
  [16, 34, 2],
  [24, 14, 2],
  [34, 44, 3],
  [42, 8, 2],
  [55, 26, 2],
  [63, 50, 3],
  [70, 16, 2],
  [86, 36, 2],
  [92, 58, 3],
  [10, 62, 2],
  [30, 72, 2],
  [48, 64, 3],
  [78, 72, 2],
  [96, 22, 2],
  [58, 82, 2],
  [18, 86, 3],
  [88, 88, 2],
];

/** The small stars on the blanket: [x, y] in the blanket picture. */
const BLANKET_STARS: readonly (readonly [number, number])[] = [
  [40, 50],
  [92, 44],
  [146, 54],
  [200, 44],
  [252, 52],
  [306, 46],
  [340, 58],
  [120, 62],
  [228, 62],
];

/** The wavy top edge of the blanket. */
const WAVE = 'Q40 12 78 24 T155 22 T232 20 T308 24 T364 22';

export const Stars = (): JSX.Element => (
  <div class="night-stars" data-part="stars">
    <For each={STARS}>
      {([x, y, size], at) => (
        <i
          style={{
            left: `${String(x)}%`,
            top: `${String(y)}%`,
            width: `${String(size)}px`,
            height: `${String(size)}px`,
            'animation-delay': `${(-at() * 0.41).toFixed(2)}s`,
          }}
        />
      )}
    </For>
  </div>
);

/** A crescent moon with a soft halo. */
export const Moon = (): JSX.Element => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <mask id="night-moon-mask">
        <rect x="-20" y="-20" width="104" height="104" fill="#fff" />
        <circle cx="44" cy="22" r="21" fill="#000" />
      </mask>
      <radialGradient id="night-moon-halo">
        <stop offset="0.55" class="night-moon-halo" stop-opacity="0.22" />
        <stop offset="1" class="night-moon-halo" stop-opacity="0" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="44" fill="url(#night-moon-halo)" />
    <circle class="night-moon-face" cx="32" cy="32" r="26" mask="url(#night-moon-mask)" />
    <circle class="night-moon-spot" cx="18" cy="38" r="3" mask="url(#night-moon-mask)" />
    <circle class="night-moon-spot" cx="26" cy="48" r="2" mask="url(#night-moon-mask)" />
  </svg>
);

/** The blanket: a wavy edge with small stars over the pals, and the cloth (CSS) down to the bottom of the screen. */
export const Blanket = (): JSX.Element => (
  <div class="night-blanket" data-part="blanket">
    <svg viewBox="0 0 370 70" preserveAspectRatio="none" aria-hidden="true">
      <path class="night-blanket-cloth" d={`M6 71 V28 ${WAVE} V71 Z`} />
      <path class="night-blanket-edge" d={`M6 28 ${WAVE}`} />
      <path class="night-blanket-seam" d="M12 33 Q40 18 78 29 T155 27 T232 25 T308 29 T358 28" />
      <For each={BLANKET_STARS}>
        {([x, y], at) => (
          <path
            class={at() % 2 ? 'night-blanket-star night-blanket-lemon' : 'night-blanket-star'}
            d={`M${String(x)} ${String(y - 6)} l1.8 4 4.2.4-3.2 2.9 1 4.2-3.8-2.2-3.8 2.2 1-4.2-3.2-2.9 4.2-.4z`}
          />
        )}
      </For>
    </svg>
  </div>
);

/** The "Zzz" of the sleep, drawn as 3 shapes that float up in turn. */
export const Zzz = (): JSX.Element => (
  <div class="night-zzz" data-part="zzz">
    <For each={[0, 1, 2]}>
      {() => (
        <svg viewBox="0 0 14 16" aria-hidden="true">
          <path d="M1 1.5 H13 L1 14.5 H13" />
        </svg>
      )}
    </For>
  </div>
);

/** The play button of the wake-up scene: it pops in, and then it pulses as on the title screen (title.css). */
export const PlaySign = (): JSX.Element => (
  <span
    class="title-play night-play"
    data-part="play"
    aria-hidden="true"
    style={{ 'animation-delay': `${String(PULSE_AT)}s` }}
  >
    <svg viewBox="0 0 24 24">
      <path d="M6 3.5 L20 12 L6 20.5 Z" />
    </svg>
  </span>
);
