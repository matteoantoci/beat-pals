// The colour tokens of style A (prototype play-style A, C27): the grape ramp, the 3 lane colours, white, and the
// record metals. Each colour is an OKLCH triple. The SVG pictures need CSS strings, and PixiJS needs numbers, so
// both come from the same maths, one time at start.

/** Lightness, chroma, and hue of one OKLCH colour. */
export type Oklch = readonly [number, number, number];

export const TOKENS = {
  g950: [0.19, 0.09, 285],
  g800: [0.3, 0.14, 285],
  g600: [0.46, 0.18, 283],
  g300: [0.82, 0.08, 285],
  berry: [0.72, 0.19, 3],
  lemon: [0.89, 0.16, 96],
  mint: [0.83, 0.13, 172],
  white: [1, 0, 0],
  bronze: [0.74, 0.15, 60],
  silver: [0.8, 0.02, 250],
  ice: [0.86, 0.09, 215],
} as const satisfies Readonly<Record<string, Oklch>>;

/** The colours of one lane, from the colours of its pal. */
type LaneColors = { readonly base: Oklch; readonly dark: Oklch; readonly light: Oklch };

/** Pip (berry), Dot (lemon), and Bo (mint). */
export const LANE_COLORS: readonly [LaneColors, LaneColors, LaneColors] = [
  { base: TOKENS.berry, dark: [0.56, 0.19, 5], light: [0.86, 0.1, 360] },
  { base: TOKENS.lemon, dark: [0.74, 0.15, 80], light: [0.96, 0.08, 100] },
  { base: TOKENS.mint, dark: [0.66, 0.12, 178], light: [0.93, 0.07, 172] },
];

const DEGREES = 180;
const BYTE = 255;
const GAMMA = 2.4;

/** Linear light to an sRGB byte. */
const encode = (linear: number): number => {
  const x = Math.min(1, Math.max(0, linear));
  return Math.round((x <= 0.003_130_8 ? 12.92 * x : 1.055 * x ** (1 / GAMMA) - 0.055) * BYTE);
};

/** OKLCH to sRGB bytes. */
const rgb = ([lightness, chroma, hue]: Oklch): readonly [number, number, number] => {
  const angle = (hue * Math.PI) / DEGREES;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const l = (lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const m = (lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const s = (lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  return [
    encode(4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s),
    encode(-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s),
    encode(-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s),
  ];
};

/** A CSS colour string, for SVG and the 2D canvas. */
export const css = (color: Oklch, alpha = 1): string => {
  const [r, g, b] = rgb(color);
  return `rgba(${String(r)},${String(g)},${String(b)},${String(alpha)})`;
};

/** A colour as the number 0xRRGGBB, for PixiJS. */
export const hex = (color: Oklch): number => {
  const [r, g, b] = rgb(color);
  return (r << 16) | (g << 8) | b;
};

/** A shade of a colour: a lightness step and a small hue turn (rims and shadows; the light comes from the top left). */
export const shade = ([lightness, chroma, hue]: Oklch, lighter: number, turn = 0): Oklch => [
  lightness + lighter,
  chroma,
  hue + turn,
];
