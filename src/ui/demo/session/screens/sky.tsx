import { For, onSettled } from 'solid-js';
import { RECORD_COLORS, type SunStage, type SunStep } from '../../../../model';
import { Record, Stars } from '../../../songs/record';
import { SongPicture } from '../../../songs/SongList';
import { SkyStrip } from '../../../sun/SkyStrip';
import type { SessionScreenProps, SessionScreens } from '../registry';
import type { JSX } from '@solidjs/web';

// The song list screens of the session demo (play-sessions spec, "Demo route"): the sky strip at each stage
// (`list-day`, `list-afternoon`, `list-sunset`) and the 3 steps (`step-1` day to late afternoon, `step-2` late
// afternoon to sunset, `step-3` day to sunset), above cards of invented songs with plain pictures.

const CARDS = [
  { title: 'Song one', color: 0, stars: 2 },
  { title: 'Song two', color: 1, stars: 3 },
  { title: 'Song three', color: 0, stars: 0 },
  { title: 'Song four', color: 2, stars: 1 },
  { title: 'Song five', color: 1, stars: 1 },
  { title: 'Song six', color: 0, stars: 3 },
] as const;

const listScreen =
  (stage: SunStage, step: SunStep | null) =>
  (props: SessionScreenProps): JSX.Element => {
    onSettled(() => {
      props.ready();
    });
    return (
      <main class="song-list">
        <SkyStrip stage={stage} step={step} reduce={props.reduce} />
        <button type="button" class="song-home" aria-label="Home">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 11.5 12 4l8 7.5V20h-5.5v-5h-5v5H4z" />
          </svg>
        </button>
        <ul class="song-cards">
          <For each={CARDS}>
            {(card) => (
              <li class="song-card">
                <button type="button" class="song-cover" aria-label={card.title}>
                  <SongPicture picture={undefined} />
                </button>
                <div class="song-shelf">
                  <Record color={RECORD_COLORS[card.color]} />
                  <Stars count={card.stars} />
                </div>
                <span class="song-title">{card.title}</span>
              </li>
            )}
          </For>
        </ul>
      </main>
    );
  };

export const screens: SessionScreens = {
  'list-day': listScreen('day', null),
  'list-afternoon': listScreen('afternoon', null),
  'list-sunset': listScreen('sunset', null),
  'step-1': listScreen('afternoon', { from: 'day', to: 'afternoon' }),
  'step-2': listScreen('sunset', { from: 'afternoon', to: 'sunset' }),
  'step-3': listScreen('sunset', { from: 'day', to: 'sunset' }),
};
