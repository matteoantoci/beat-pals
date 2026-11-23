// The 15 still pictures of the pals (spec, "Screens"): 3 pals with 5 states each, drawn as SVG by the prototype
// function `palSVG` of play-style A, with its colours. Animated WebP files come later, as a separate art task.

import { css, LANE_COLORS, type Oklch } from './color';

/** idle; ready (wide eyes, open mouth) before a note; happy after a hit; held during a soft hold; joy from
 * energy step 1. */
const PAL_STATES = ['idle', 'ready', 'happy', 'held', 'joy'] as const;

export type PalState = (typeof PAL_STATES)[number];

/** 0 Pip, 1 Dot, 2 Bo. */
export type PalIndex = 0 | 1 | 2;

const INK = css([0.22, 0.07, 285]);
const [PIP, DOT, BO] = LANE_COLORS;

/** One construction for the 3 accessories: a stem with a dark outline in the colour family of the pal. */
const stem = (path: string, color: Oklch): string =>
  `<path d="${path}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${path}" fill="none" stroke="${css(color)}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;

/** The round tip of an accessory: a circle given as [x, y, r]. */
const knob = ([x, y, r]: readonly [number, number, number], color: Oklch): string =>
  `<circle cx="${String(x)}" cy="${String(y)}" r="${String(r)}" fill="${css(color)}" stroke="${INK}" stroke-width="2"/>`;

type PalDrawing = {
  readonly shape: (fill: string) => string;
  readonly extra: string;
  readonly hi: readonly [number, number];
  readonly faceY: number;
  readonly cheek: string;
};

const PALS: readonly [PalDrawing, PalDrawing, PalDrawing] = [
  // Pip: a round berry pal with a small curl that ends in a lemon knob.
  {
    shape: (fill) => `<circle cx="60" cy="68" r="48" fill="${fill}"/>`,
    extra: stem('M58 24 C56 14 62 8 70 11', PIP.dark) + knob([71, 12, 6], DOT.base),
    hi: [40, 44],
    faceY: 64,
    cheek: css([0.58, 0.19, 5], 0.75),
  },
  // Dot: a lemon block with a straight antenna and a pink knob.
  {
    shape: (fill) => `<rect x="12" y="24" width="96" height="92" rx="30" fill="${fill}"/>`,
    extra: stem('M60 26 V10', DOT.dark) + knob([60, 9, 7], PIP.base),
    hi: [34, 42],
    faceY: 64,
    cheek: css([0.72, 0.19, 3], 0.6),
  },
  // Bo: a tall mint arch with a short sprout and one berry leaf.
  {
    shape: (fill) => `<path d="M16 116 V64 a44 44 0 0 1 88 0 V116 q0 0 -6 0 H22 q-6 0 -6 0z" fill="${fill}"/>`,
    extra:
      stem('M60 24 Q58 15 62 10', BO.dark) +
      `<path d="M62 11 q1 -10 13 -10 q0 10 -13 10z" fill="${css(PIP.base)}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    hi: [36, 44],
    faceY: 66,
    cheek: css([0.72, 0.19, 3], 0.55),
  },
];

const isGlad = (state: PalState): boolean => state === 'happy' || state === 'held' || state === 'joy';

const eye = (x: number, y: number, state: PalState): string => {
  if (isGlad(state)) {
    return `<path d="M${String(x - 9)} ${String(y + 2)} q9 -12 18 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  }
  const ready = state === 'ready';
  const up = ready ? -5 : 1;
  return (
    `<ellipse cx="${String(x)}" cy="${String(y)}" rx="11" ry="${ready ? '13' : '12'}" fill="#fff"/>` +
    `<circle cx="${String(x + 1)}" cy="${String(y + up)}" r="6.5" fill="${INK}"/>` +
    `<circle cx="${String(x + 3)}" cy="${String(y + up - 3)}" r="2.2" fill="#fff"/>`
  );
};

const TONGUE = css(PIP.dark);
const SMILE = (my: number): string =>
  `<path d="M50 ${String(my - 2)} q10 10 20 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;

/** The mouth of each state, at the mouth height `my`. */
const MOUTHS: Readonly<Record<PalState, (my: number) => string>> = {
  ready: (my) =>
    `<ellipse cx="60" cy="${String(my + 2)}" rx="11" ry="13" fill="${INK}"/><ellipse cx="60" cy="${String(my + 10)}" rx="7" ry="4" fill="${TONGUE}"/>`,
  happy: (my) =>
    `<path d="M42 ${String(my - 3)} q18 24 36 0 z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="60" cy="${String(my + 6)}" rx="8" ry="4" fill="${TONGUE}"/>`,
  held: (my) => `<ellipse cx="60" cy="${String(my + 1)}" rx="6.5" ry="7.5" fill="${INK}"/>`,
  idle: SMILE,
  joy: SMILE,
};

const face = (pal: PalDrawing, state: PalState): string => {
  const my = pal.faceY + 22;
  const [rx, ry] = state === 'held' ? ['11', '8'] : ['8', '5'];
  const cheek = (x: number): string =>
    `<ellipse cx="${String(x)}" cy="${String(my - 4)}" rx="${rx}" ry="${ry}" fill="${pal.cheek}"/>`;
  return (
    `<g opacity="${isGlad(state) ? '1' : '0.55'}">${cheek(31)}${cheek(89)}</g>` +
    eye(44, pal.faceY, state) +
    eye(76, pal.faceY, state) +
    MOUTHS[state](my)
  );
};

/** The picture of one pal in one state, as a data URI for an `<img>`. */
const palSvg = (index: PalIndex, state: PalState): string => {
  const pal = PALS[index];
  const colors = LANE_COLORS[index];
  const [hx, hy] = pal.hi;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${pal.extra}${pal.shape(css(colors.dark))}` +
    `<g transform="translate(-2 -4)">${pal.shape(css(colors.base))}</g>` +
    `<ellipse cx="${String(hx)}" cy="${String(hy)}" rx="11" ry="6" transform="rotate(-35 ${String(hx)} ${String(hy)})" fill="#fff" opacity=".55"/>` +
    `${face(pal, state)}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const PAL_INDEXES: readonly PalIndex[] = [0, 1, 2];
const PICTURES: readonly (readonly string[])[] = PAL_INDEXES.map((index) =>
  PAL_STATES.map((state) => palSvg(index, state))
);

/** The data URI of a pal picture. */
export const palPicture = (index: PalIndex, state: PalState): string =>
  PICTURES[index]?.[PAL_STATES.indexOf(state)] ?? '';

let decoded: Promise<void> | undefined;

/** Decodes all 15 pictures one time, so no state change of a pal waits for a decode during a song (C21). */
export const decodePals = (): Promise<void> => {
  decoded ??= Promise.all(
    PICTURES.flat().map(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
    })
  ).then(() => undefined);
  return decoded;
};
