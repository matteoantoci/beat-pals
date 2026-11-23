import { css, shade, TOKENS } from '../pals/color';
import { palPicture } from '../pals/pal-svg';
import type { JSX } from 'solid-js';

// The song list with no ready songs (spec, "Screens"): the pals stand next to a closed record box. No text, and
// nothing to tap here.

const BOX = css(TOKENS.g600);
const BOX_DARK = css(shade(TOKENS.g600, -0.08));
const LID = css(shade(TOKENS.g600, 0.06));
const INK = css(TOKENS.g950);
const LABEL = css(TOKENS.bronze);

/** A closed box with a record drawn on its front. */
const RecordBox = (): JSX.Element => (
  <svg class="closed-box" viewBox="0 0 120 120" aria-hidden="true">
    <rect x="12" y="44" width="96" height="72" rx="8" fill={INK} />
    <rect x="12" y="40" width="96" height="72" rx="8" fill={BOX} />
    <rect x="12" y="92" width="96" height="20" rx="8" fill={BOX_DARK} />
    <rect x="8" y="28" width="104" height="20" rx="8" fill={LID} />
    <circle cx="60" cy="76" r="24" fill={INK} />
    <circle cx="60" cy="76" r="17" fill="none" stroke={BOX} stroke-width="2" />
    <circle cx="60" cy="76" r="8" fill={LABEL} />
  </svg>
);

export const ClosedRecordBox = (): JSX.Element => (
  <div class="song-closed-box">
    <img class="box-pal" src={palPicture(0, 'idle')} alt="" draggable={false} />
    <img class="box-pal" src={palPicture(1, 'idle')} alt="" draggable={false} />
    <RecordBox />
    <img class="box-pal" src={palPicture(2, 'idle')} alt="" draggable={false} />
  </div>
);
