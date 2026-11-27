import { For } from 'solid-js';
import { css, LANE_COLORS, TOKENS } from '../pals/color';
import type { JSX } from '@solidjs/web';

// The sun of the session scenes (play-sessions spec, "Screens and motion"): the lemon label of the logo with the
// logo face, a glow, and 12 rays, as in the sunset prototype (sunHtml). The faces get sleepier over the stages, but
// the sun always smiles: happy (open eyes, day), calm (happy closed upward arcs and a small open smile, late
// afternoon), droopy (closed downward arcs and a calm smile, sunset), blink, yawn, and asleep.
// The root is absolute and centred on its left and top. Its size comes from --sun-d, the diameter of the disc in px,
// and its colour from --sunc (a registered colour, so a scene can animate it). A scene moves the parts through
// their classes: .sun-y (translate), .sun-s (uniform scale only, so the sun stays round), .sun-rays, and
// .sun-face with its data-face. The first face of `faces` shows, and the other faces wait at opacity 0.

export type SunFace = 'happy' | 'calm' | 'droopy' | 'blink' | 'yawn' | 'asleep';

export type SunRays = { readonly opacity: number; readonly scale: number };

const INK = css(TOKENS.g950);
const WHITE = css(TOKENS.white);
const TONGUE = css(LANE_COLORS[0].dark);
const CHEEK = css(TOKENS.berry, 0.6);

const SMILES = {
  happy: 'M53 67 Q60 74 67 67',
  droopy: 'M55 67.5 Q60 72 65 67.5',
  asleep: 'M56 68 Q60 70.5 64 68',
} as const;

const Smile = (props: { readonly kind: keyof typeof SMILES }): JSX.Element => (
  <path d={SMILES[props.kind]} fill="none" stroke={INK} stroke-width="3.2" stroke-linecap="round" />
);

/** Closed eyes that curve down. */
const Closed = (): JSX.Element => (
  <path d="M47 56.5 q5 5 10 0 M63 56.5 q5 5 10 0" fill="none" stroke={INK} stroke-width="3" stroke-linecap="round" />
);

const EYES_X = [52, 68] as const;

const FACES: Readonly<Record<SunFace, () => JSX.Element>> = {
  happy: () => (
    <>
      <For each={EYES_X}>
        {(x) => (
          <>
            <ellipse cx={x} cy="57" rx="5.5" ry="6.5" fill={WHITE} />
            <circle cx={x + 0.6} cy="57.8" r="3.3" fill={INK} />
            <circle cx={x + 1.8} cy="56.2" r="1.1" fill={WHITE} />
          </>
        )}
      </For>
      <Smile kind="happy" />
    </>
  ),
  calm: () => (
    <>
      <path
        d="M47 58.5 q5 -5.5 10 0 M63 58.5 q5 -5.5 10 0"
        fill="none"
        stroke={INK}
        stroke-width="3"
        stroke-linecap="round"
      />
      <path d="M55.5 66.5 Q60 72.5 64.5 66.5 Z" fill={INK} stroke={INK} stroke-width="1.6" stroke-linejoin="round" />
      <ellipse cx="60" cy="69.4" rx="2.2" ry="1.1" fill={TONGUE} />
    </>
  ),
  droopy: () => (
    <>
      <Closed />
      <Smile kind="droopy" />
    </>
  ),
  blink: () => (
    <>
      <Closed />
      <Smile kind="happy" />
    </>
  ),
  yawn: () => (
    <>
      <path
        d="M47 58 q5 -4.5 10 0 M63 58 q5 -4.5 10 0"
        fill="none"
        stroke={INK}
        stroke-width="3"
        stroke-linecap="round"
      />
      <ellipse cx="60" cy="69" rx="4.2" ry="5.6" fill={INK} />
      <ellipse cx="60" cy="72" rx="2.6" ry="1.5" fill={TONGUE} />
    </>
  ),
  asleep: () => (
    <>
      <For each={EYES_X}>
        {(x) => (
          <>
            <path d={`M${x - 5} 57 q5 4.5 10 0`} fill="none" stroke={INK} stroke-width="3" stroke-linecap="round" />
            <path
              d={`M${x - 4} 59.6 l-1.6 2 M${x} 60.4 v2.4 M${x + 4} 59.6 l1.6 2`}
              stroke={INK}
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </>
        )}
      </For>
      <Smile kind="asleep" />
    </>
  ),
};

const RAY_ANGLES = Array.from({ length: 12 }, (_, at) => ((at * 30 + 15) * Math.PI) / 180);

export const Sun = (props: {
  readonly faces: readonly SunFace[];
  readonly color: string;
  readonly rays: SunRays;
  readonly class?: string;
  readonly style?: string;
}): JSX.Element => (
  <div
    class={props.class ? `sun ${props.class}` : 'sun'}
    style={`--sunc:${props.color};${props.style ?? ''}`}
    aria-hidden="true"
  >
    <div class="sun-y">
      <div class="sun-s">
        <div class="sun-glow" />
        <svg class="sun-svg" viewBox="-64 -64 128 128">
          <g class="sun-rays" style={`opacity:${props.rays.opacity};scale:${props.rays.scale}`}>
            <For each={RAY_ANGLES}>
              {(angle) => (
                <line
                  x1={(Math.cos(angle) * 44).toFixed(1)}
                  y1={(Math.sin(angle) * 44).toFixed(1)}
                  x2={(Math.cos(angle) * 54).toFixed(1)}
                  y2={(Math.sin(angle) * 54).toFixed(1)}
                />
              )}
            </For>
          </g>
          <circle class="sun-disc" r="36" />
          <g transform="scale(1.44) translate(-60 -60)">
            <ellipse cx="44" cy="66" rx="4" ry="2.5" fill={CHEEK} />
            <ellipse cx="76" cy="66" rx="4" ry="2.5" fill={CHEEK} />
            <For each={props.faces}>
              {(face, at) => (
                <g class="sun-face" data-face={face} style={at() === 0 ? undefined : 'opacity:0'}>
                  {FACES[face]()}
                </g>
              )}
            </For>
          </g>
          <path class="sun-shine" d="M-27 -12 A30 30 0 0 1 -13 -27" />
        </svg>
      </div>
    </div>
  </div>
);
