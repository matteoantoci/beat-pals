import { createSignal, For, onSettled, Show } from 'solid-js';
import { RECORD_COLORS } from '../../model';
import { loadFamilyKey, readCover, readSongStore, watchDownload } from '../../shell/songs';
import { playTitleMusic } from '../../sound';
import { palPicture } from '../pals/pal-svg';
import { reducedMotion } from '../play/reduced-motion';
import { useStorage } from '../storage';
import { SkyStrip } from '../sun/SkyStrip';
import { Record, Stars } from './record';
import type { FamilyKey, IndexSong, SunStage, SunStep } from '../../model';
import type { JSX } from '@solidjs/web';
import type { Accessor } from 'solid-js';

// The song list (spec, "Screens"): only the ready songs, in the order of the song index (by title). Each card has
// the picture, a record of the record color next to the 3 stars, and the title for the Parent. One tap on the
// picture starts the song. A song shows when all its files are in the cache, so the list fills during a download.
// The title screen opens the list only when a song is ready. The title music plays on, and a tap starts it again
// when it does not play.
// Play sessions (play-sessions spec, "Screens and motion"): each open of the list gets the sun stage of the session
// and the step of the sun that plays, or none. The sky strip at the top shows them (src/ui/sun/SkyStrip.tsx), and
// the list gives the stage in `data-sun-stage`.

type Card = { song: IndexSong; picture: string | undefined };

/** What a tap on a card starts: the song and the key that opens its files. */
export type SongChoice = { readonly song: IndexSong; readonly key: FamilyKey };

/** The sun of the list: the stage to show, and the step that plays at this open of the list, or null. */
export type SunView = { readonly stage: SunStage; readonly step: SunStep | null };

type Cards = {
  readonly cards: Accessor<readonly Card[]>;
  readonly key: () => FamilyKey | undefined;
};

/** A failed read of the cache leaves the list as it is. */
const ignore = (): void => undefined;

/** The cover picture of the song as an object URL, or undefined for a song with a plain card. */
export const pictureOf = async (key: FamilyKey, song: IndexSong): Promise<string | undefined> => {
  const cover = await readCover(key, song);
  return cover === null ? undefined : URL.createObjectURL(cover);
};

/**
 * The cards of the ready songs. They come from the cache when the list shows, and from each progress event of a
 * download. The object URLs of the pictures are revoked when the list closes.
 */
const readyCards = (): Cards => {
  const [cards, setCards] = createSignal<readonly Card[]>([]);
  /** The songs with a card or with a card on the way, so 2 progress events never make 2 cards. */
  const seen = new Set<string>();
  let key: FamilyKey | undefined;
  const add = async (ready: readonly IndexSong[]): Promise<void> => {
    const songKey = key;
    const fresh = ready.filter((song) => !seen.has(song.id));
    if (songKey === undefined || fresh.length === 0) {
      return;
    }
    for (const song of fresh) {
      seen.add(song.id);
    }
    const added = await Promise.all(fresh.map(async (song) => ({ song, picture: await pictureOf(songKey, song) })));
    // The ready list has the index order, so each card takes the place of its song.
    const order = new Map(ready.map((song, at) => [song.id, at]));
    const rank = (card: Card): number => order.get(card.song.id) ?? 0;
    // The updater form reads the cards with the staged writes, so a second card list that arrives before the flush
    // does not drop the first.
    setCards((current) => [...current, ...added].toSorted((one, two) => rank(one) - rank(two)));
  };
  const loadCards = async (): Promise<void> => {
    key = await loadFamilyKey();
    const store = key === undefined ? undefined : await readSongStore(key);
    await add(store?.ok === true ? store.plan.ready : []);
  };
  onSettled(() => {
    const unwatch = watchDownload((event) => {
      if (event.type === 'progress') {
        add(event.plan.ready).catch(ignore);
      }
    });
    // With no key, no network, or no store, the list has no songs.
    loadCards().catch(ignore);
    return () => {
      unwatch();
      for (const card of cards()) {
        URL.revokeObjectURL(card.picture ?? '');
      }
    };
  });
  return { cards, key: () => key };
};

/** A home, drawn as a house. */
const HomeIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 11.5 12 4l8 7.5V20h-5.5v-5h-5v5H4z" />
  </svg>
);

/** The cover picture of a song, or a plain card with Dot for a song with no picture. */
export const SongPicture = (props: { readonly picture: string | undefined }): JSX.Element => (
  <Show
    when={props.picture}
    fallback={
      <span class="song-picture song-plain">
        <img src={palPicture(1, 'idle')} alt="" draggable="false" />
      </span>
    }
  >
    {(picture) => <img class="song-picture" src={picture()} alt="" draggable="false" />}
  </Show>
);

const SongCard = (props: { readonly card: Card; readonly onTap: () => void }): JSX.Element => {
  const progress = useStorage().save.progressOf(props.card.song.id);
  return (
    <li class="song-card">
      <button type="button" class="song-cover" aria-label={props.card.song.title} onClick={() => props.onTap()}>
        <SongPicture picture={props.card.picture} />
      </button>
      <div class="song-shelf">
        <Record color={RECORD_COLORS[progress.color]} />
        <Stars count={progress.stars} />
      </div>
      <span class="song-title">{props.card.song.title}</span>
    </li>
  );
};

type SongListProps = {
  readonly sun: SunView;
  readonly onHome: () => void;
  readonly onPlay: (choice: SongChoice) => void;
};

export const SongList = (props: SongListProps): JSX.Element => {
  const { cards, key } = readyCards();
  onSettled(() => {
    playTitleMusic();
    document.addEventListener('pointerup', playTitleMusic, { passive: true });
    return () => document.removeEventListener('pointerup', playTitleMusic);
  });
  const play = (song: IndexSong): void => {
    const songKey = key();
    if (songKey !== undefined) {
      props.onPlay({ song, key: songKey });
    }
  };
  return (
    <main class="song-list" data-sun-stage={props.sun.stage}>
      <SkyStrip stage={props.sun.stage} step={props.sun.step} reduce={reducedMotion()} />
      <button type="button" class="song-home" aria-label="Home" onClick={() => props.onHome()}>
        <HomeIcon />
      </button>
      <ul class="song-cards">
        <For each={cards()}>{(card) => <SongCard card={card} onTap={() => play(card.song)} />}</For>
      </ul>
    </main>
  );
};
