// The 18 still pictures of the pals (spec, "Screens"): 3 pals with 6 states each, drawn as SVG by the prototype
// function `palSVG` of play-style A, with its colours, and the oops state of the loading prototype. Animated WebP
// files come later, as a separate art task.
// The session scenes (play-sessions spec, "Screens and motion") also use a yawn face, a sleep face, and an arm for
// each pal, as drawn in the sunset prototype. These parts are not play pictures: the play still decodes 18
// pictures before a song, and the session scenes decode their parts with `decodeSessionPals`.

import { css, LANE_COLORS, TOKENS, type Oklch } from './color';

/** idle; ready (wide eyes, open mouth) before a note and during the load; happy after a hit; held during a soft
 * hold; joy from energy step 1; oops when a song does not load ("whoops!", not sad). */
const PAL_STATES = ['idle', 'ready', 'happy', 'held', 'joy', 'oops'] as const;

export type PalState = (typeof PAL_STATES)[number];

/** The faces of the session scenes only: yawn (squeezed happy eyes, a tall open mouth) and sleep (closed eyes that
 * curve down, a small calm mouth). */
const SESSION_FACES = ['yawn', 'sleep'] as const;

type SessionFace = (typeof SESSION_FACES)[number];

/** A face of a pal in the session scenes: a play state, the yawn, or the sleep. */
export type PalFace = PalState | SessionFace;

const isSessionFace = (face: PalFace): face is SessionFace => face === 'yawn' || face === 'sleep';

/** 0 Pip, 1 Dot, 2 Bo. */
export type PalIndex = 0 | 1 | 2;

/** The pal art uses the palette only: the dark ink, the lane colours with their shades, and white (C27). */
const INK = css(TOKENS.g950);
const WHITE = css(TOKENS.white);
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
    cheek: css(PIP.dark, 0.75),
  },
  // Dot: a lemon block with a straight antenna and a pink knob.
  {
    shape: (fill) => `<rect x="12" y="24" width="96" height="92" rx="30" fill="${fill}"/>`,
    extra: stem('M60 26 V10', DOT.dark) + knob([60, 9, 7], PIP.base),
    hi: [34, 42],
    faceY: 64,
    cheek: css(PIP.base, 0.6),
  },
  // Bo: a tall mint arch with a short sprout and one berry leaf.
  {
    shape: (fill) => `<path d="M16 116 V64 a44 44 0 0 1 88 0 V116 q0 0 -6 0 H22 q-6 0 -6 0z" fill="${fill}"/>`,
    extra:
      stem('M60 24 Q58 15 62 10', BO.dark) +
      `<path d="M62 11 q1 -10 13 -10 q0 10 -13 10z" fill="${css(PIP.base)}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    hi: [36, 44],
    faceY: 66,
    cheek: css(PIP.base, 0.55),
  },
];

const isGlad = (face: PalFace): boolean => face === 'happy' || face === 'held' || face === 'joy';

const eye = (x: number, y: number, state: PalFace): string => {
  if (isGlad(state)) {
    return `<path d="M${String(x - 9)} ${String(y + 2)} q9 -12 18 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  }
  // yawn: a flatter happy arc, as the eyes squeeze; sleep: a closed eye that curves down.
  if (isSessionFace(state)) {
    const arc =
      state === 'yawn' ? `M${String(x - 9)} ${String(y + 2)} q9 -9 18 0` : `M${String(x - 9)} ${String(y)} q9 9 18 0`;
    return `<path d="${arc}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  }
  // oops: the pupils look up and to the side, under a raised round brow.
  const oops = state === 'oops';
  const up = state === 'ready' ? -5 : oops ? -3 : 1;
  const side = oops ? 4 : 1;
  const brow = oops
    ? `<path d="M${String(x - 9)} ${String(y - 18)} q9 -8 18 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
    : '';
  return (
    `<ellipse cx="${String(x)}" cy="${String(y)}" rx="11" ry="${state === 'ready' || oops ? '13' : '12'}" fill="${WHITE}"/>` +
    `<circle cx="${String(x + side)}" cy="${String(y + up)}" r="6.5" fill="${INK}"/>` +
    `<circle cx="${String(x + side + 2)}" cy="${String(y + up - 3)}" r="2.2" fill="${WHITE}"/>` +
    brow
  );
};

const TONGUE = css(PIP.dark);
const SMILE = (my: number): string =>
  `<path d="M50 ${String(my - 2)} q10 10 20 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;

/** The mouth of each face, at the mouth height `my`. */
const MOUTHS: Readonly<Record<PalFace, (my: number) => string>> = {
  ready: (my) =>
    `<ellipse cx="60" cy="${String(my + 2)}" rx="11" ry="13" fill="${INK}"/><ellipse cx="60" cy="${String(my + 10)}" rx="7" ry="4" fill="${TONGUE}"/>`,
  happy: (my) =>
    `<path d="M42 ${String(my - 3)} q18 24 36 0 z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="60" cy="${String(my + 6)}" rx="8" ry="4" fill="${TONGUE}"/>`,
  held: (my) => `<ellipse cx="60" cy="${String(my + 1)}" rx="6.5" ry="7.5" fill="${INK}"/>`,
  idle: SMILE,
  joy: SMILE,
  // a small round "o" to one side
  oops: (my) => `<ellipse cx="65" cy="${String(my + 1)}" rx="5" ry="5.5" fill="${INK}"/>`,
  // a tall open mouth with the tongue at the bottom
  yawn: (my) =>
    `<ellipse cx="60" cy="${String(my + 3)}" rx="10" ry="15" fill="${INK}"/><ellipse cx="60" cy="${String(my + 12)}" rx="6" ry="4" fill="${TONGUE}"/>`,
  sleep: (my) =>
    `<path d="M54 ${String(my)} q6 4 12 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
};

const face = (pal: PalDrawing, state: PalFace): string => {
  const my = pal.faceY + 22;
  const [rx, ry] = state === 'held' ? ['11', '8'] : ['8', '5'];
  const cheek = (x: number): string =>
    `<ellipse cx="${String(x)}" cy="${String(my - 4)}" rx="${rx}" ry="${ry}" fill="${pal.cheek}"/>`;
  return (
    `<g opacity="${isGlad(state) || isSessionFace(state) ? '1' : '0.55'}">${cheek(31)}${cheek(89)}</g>` +
    eye(44, pal.faceY, state) +
    eye(76, pal.faceY, state) +
    MOUTHS[state](my)
  );
};

/** The picture of one pal with one face, as a data URI for an `<img>`. */
const palSvg = (index: PalIndex, state: PalFace): string => {
  const pal = PALS[index];
  const colors = LANE_COLORS[index];
  const [hx, hy] = pal.hi;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${pal.extra}${pal.shape(css(colors.dark))}` +
    `<g transform="translate(-2 -4)">${pal.shape(css(colors.base))}</g>` +
    `<ellipse cx="${String(hx)}" cy="${String(hy)}" rx="11" ry="6" transform="rotate(-35 ${String(hx)} ${String(hy)})" fill="${WHITE}" opacity=".55"/>` +
    `${face(pal, state)}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/** An arm that comes out from behind a pal, with a round mitten in the colour of the pal and a highlight. Its
 * shoulder is at the bottom (x 20, y 76 of 80). */
const armSvg = (index: PalIndex): string => {
  const color = css(LANE_COLORS[index].base);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80">` +
    `<path d="M20 76 V30" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>` +
    `<path d="M20 76 V30" stroke="${color}" stroke-width="10" stroke-linecap="round"/>` +
    `<circle cx="20" cy="26" r="10" fill="${color}" stroke="${INK}" stroke-width="2.5"/>` +
    `<ellipse cx="16.5" cy="22.5" rx="3" ry="2" fill="${WHITE}" opacity=".55"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const PAL_INDEXES: readonly PalIndex[] = [0, 1, 2];
const PICTURES: readonly (readonly string[])[] = PAL_INDEXES.map((index) =>
  PAL_STATES.map((state) => palSvg(index, state))
);
const SESSION_PICTURES: readonly (readonly string[])[] = PAL_INDEXES.map((index) =>
  SESSION_FACES.map((sessionFace) => palSvg(index, sessionFace))
);
const ARMS: readonly string[] = PAL_INDEXES.map(armSvg);

/** The data URI of a pal picture. */
export const palPicture = (index: PalIndex, state: PalState): string =>
  PICTURES[index]?.[PAL_STATES.indexOf(state)] ?? '';

/** The data URI of a pal with a face of the session scenes. A play state gives the play picture. */
export const palFacePicture = (index: PalIndex, state: PalFace): string =>
  isSessionFace(state) ? (SESSION_PICTURES[index]?.[SESSION_FACES.indexOf(state)] ?? '') : palPicture(index, state);

/** The data URI of the arm of a pal. The same picture is the left arm and the right arm. */
export const armPicture = (index: PalIndex): string => ARMS[index] ?? '';

const decodeAll = async (pictures: readonly string[]): Promise<void> => {
  await Promise.all(
    pictures.map(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
    })
  );
};

let decoded: Promise<void> | undefined;
let sessionDecoded: Promise<void> | undefined;

/** Decodes all 18 pictures one time, so no state change of a pal waits for a decode during a song (C21). */
export const decodePals = (): Promise<void> => {
  decoded ??= decodeAll(PICTURES.flat());
  return decoded;
};

/** Decodes the yawn and sleep faces and the arms one time, so no face change of a session scene waits for a decode.
 * The play states of the session scenes come from `decodePals`. */
export const decodeSessionPals = (): Promise<void> => {
  sessionDecoded ??= decodeAll([...SESSION_PICTURES.flat(), ...ARMS]);
  return sessionDecoded;
};
