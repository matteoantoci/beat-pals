import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { RECORD_COLORS } from '../../model';
import { progressOf } from '../../shell/save';
import { loadFamilyKey, readCover, readSongStore, watchDownload } from '../../shell/songs';
import { playTitleMusic } from '../../sound';
import { palPicture } from '../pals/pal-svg';
import { ClosedRecordBox } from './ClosedRecordBox';
import { Record, Stars } from './record';
import type { FamilyKey, IndexSong } from '../../model';
import type { Accessor, JSX } from 'solid-js';

// The song list (spec, "Screens"): only the ready songs, in the order of the song index (by title). Each card has
// the picture, a record of the record color next to the 3 stars, and the title for the Parent. One tap on the
// picture starts the song. A song shows when all its files are in the cache, so the list fills during a download.
// With no ready song, the pals stand next to a closed record box. The title music plays on, and a tap starts it
// again when it does not play.

type Card = { song: IndexSong; picture: string | undefined };

/** What a tap on a card starts: the song and the key that opens its files. */
export type SongChoice = { readonly song: IndexSong; readonly key: FamilyKey };

type Cards = {
  readonly cards: Accessor<readonly Card[]>;
  readonly read: Accessor<boolean>;
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
  const [read, setRead] = createSignal(false);
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
    setCards([...cards(), ...added].toSorted((one, two) => rank(one) - rank(two)));
  };
  const loadCards = async (): Promise<void> => {
    key = await loadFamilyKey();
    const store = key === undefined ? undefined : await readSongStore(key);
    await add(store?.ok === true ? store.plan.ready : []);
  };
  onMount(() => {
    onCleanup(
      watchDownload((event) => {
        if (event.type === 'progress') {
          add(event.plan.ready).catch(ignore);
        }
      })
    );
    onCleanup(() => {
      for (const card of cards()) {
        URL.revokeObjectURL(card.picture ?? '');
      }
    });
    // With no key, no network, or no store, the list has no songs.
    loadCards()
      .catch(ignore)
      .finally(() => setRead(true));
  });
  return { cards, read, key: () => key };
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
        <img src={palPicture(1, 'idle')} alt="" draggable={false} />
      </span>
    }
  >
    {(picture) => <img class="song-picture" src={picture()} alt="" draggable={false} />}
  </Show>
);

const SongCard = (props: { readonly card: Card; readonly onTap: () => void }): JSX.Element => {
  const progress = progressOf(props.card.song.id);
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

type SongListProps = { readonly onHome: () => void; readonly onPlay: (choice: SongChoice) => void };

export const SongList = (props: SongListProps): JSX.Element => {
  const { cards, read, key } = readyCards();
  onMount(() => {
    playTitleMusic();
    document.addEventListener('pointerup', playTitleMusic, { passive: true });
    onCleanup(() => document.removeEventListener('pointerup', playTitleMusic));
  });
  const play = (song: IndexSong): void => {
    const songKey = key();
    if (songKey !== undefined) {
      props.onPlay({ song, key: songKey });
    }
  };
  return (
    <main class="song-list">
      <button type="button" class="song-home" aria-label="Home" onClick={() => props.onHome()}>
        <HomeIcon />
      </button>
      <Show when={read() && cards().length === 0}>
        <ClosedRecordBox />
      </Show>
      <ul class="song-cards">
        <For each={cards()}>{(card) => <SongCard card={card} onTap={() => play(card.song)} />}</For>
      </ul>
    </main>
  );
};
