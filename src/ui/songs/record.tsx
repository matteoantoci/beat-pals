import { For } from 'solid-js';
import { css, shade, TOKENS, type Oklch } from '../pals/color';
import type { RecordColor } from '../../model';
import type { JSX } from 'solid-js';

// The reward shelf of a song card (spec, "Screens"): a record in the record color next to 3 stars. The whole disc
// has the color, so it reads at a glance. Platinum has a second shine line and diamond has white sparkles, so each
// record differs by a mark and not only by color.

/** `shine` is the color of the shine lines: white, but silver on the white platinum disc so that they show. */
type RecordShades = { readonly base: Oklch; readonly dark: Oklch; readonly groove: Oklch; readonly shine?: Oklch };

const RECORDS: Readonly<Record<RecordColor, RecordShades>> = {
  bronze: { base: TOKENS.bronze, dark: shade(TOKENS.bronze, -0.2, -8), groove: shade(TOKENS.bronze, -0.1, -4) },
  silver: { base: TOKENS.silver, dark: shade(TOKENS.silver, -0.26), groove: shade(TOKENS.silver, -0.14) },
  gold: { base: TOKENS.lemon, dark: shade(TOKENS.lemon, -0.2, -18), groove: shade(TOKENS.lemon, -0.09, -10) },
  platinum: {
    base: TOKENS.white,
    dark: shade(TOKENS.silver, -0.18),
    groove: shade(TOKENS.silver, 0.06),
    shine: shade(TOKENS.silver, -0.12),
  },
  diamond: { base: TOKENS.ice, dark: shade(TOKENS.ice, -0.24, 10), groove: shade(TOKENS.ice, -0.1) },
};

const INK = css(TOKENS.g950);
const STAR_PATH = 'M12 1.8l2.9 6.4 7 .8-5.2 4.7 1.5 6.9L12 17.1l-6.2 3.5 1.5-6.9L2.1 9l7-.8z';
const STAR_ON = { fill: css(TOKENS.lemon), stroke: css(shade(TOKENS.lemon, -0.15, -16)) };
const STAR_OFF = { fill: css(TOKENS.g950, 0.4), stroke: css(TOKENS.g300) };

const RecordMark = (props: { readonly color: RecordColor; readonly shine: string }): JSX.Element => {
  if (props.color === 'diamond') {
    return (
      <path
        d="M44 10 Q44 18 52 18 Q44 18 44 26 Q44 18 36 18 Q44 18 44 10Z M20 40 Q20 45 25 45 Q20 45 20 50 Q20 45 15 45 Q20 45 20 40Z"
        fill="#fff"
      />
    );
  }
  if (props.color === 'platinum') {
    return (
      <path d="M46 50 A22 22 0 0 0 54 38" fill="none" stroke={props.shine} stroke-width="4" stroke-linecap="round" />
    );
  }
  return null;
};

export const Record = (props: { readonly color: RecordColor }): JSX.Element => {
  const shades = (): RecordShades => RECORDS[props.color];
  const shine = (): string => css(shades().shine ?? TOKENS.white);
  return (
    <svg class="song-record" viewBox="0 0 64 64" role="img" aria-label={`${props.color} record`}>
      <circle cx="32" cy="34" r="30" fill={INK} />
      <circle cx="32" cy="32" r="29" fill={css(shades().base)} stroke={css(shades().dark)} stroke-width="2" />
      <circle cx="32" cy="32" r="23" fill="none" stroke={css(shades().groove)} stroke-width="2" />
      <circle cx="32" cy="32" r="17" fill="none" stroke={css(shades().groove)} stroke-width="2" />
      <circle cx="32" cy="32" r="10" fill={INK} />
      <circle cx="32" cy="32" r="3" fill={css(shades().base)} />
      <path
        d="M10 24 A23 23 0 0 1 24 10"
        fill="none"
        stroke={shine()}
        stroke-width="4"
        stroke-linecap="round"
        opacity=".7"
      />
      <RecordMark color={props.color} shine={shine()} />
    </svg>
  );
};

/** One star: lemon when earned, a dark place with a light rim when not. */
export const StarIcon = (props: { readonly on: boolean; readonly class?: string }): JSX.Element => {
  const look = (): typeof STAR_ON => (props.on ? STAR_ON : STAR_OFF);
  return (
    <svg class={props.class} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={STAR_PATH}
        fill={look().fill}
        stroke={look().stroke}
        stroke-width="2"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  );
};

/** The 3 star places of a record color, with the earned stars filled. */
export const Stars = (props: { readonly count: number }): JSX.Element => (
  <div class="song-stars" role="img" aria-label={`${String(props.count)} stars`}>
    <For each={[0, 1, 2]}>{(place) => <StarIcon on={place < props.count} />}</For>
  </div>
);
