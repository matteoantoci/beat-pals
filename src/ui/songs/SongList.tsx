import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { loadFamilyKey, readCover, readSongStore, watchDownload } from '../../shell/songs';
import { playTitleMusic } from '../../sound';
import type { FamilyKey, IndexSong } from '../../model';
import type { Accessor, JSX } from 'solid-js';

// The song list (spec, "Screens"): only the ready songs, in the order of the song index (by title), each with its
// picture. A song shows when all its files are in the cache, so the list fills during a download.
// The title music plays on, and a tap starts it again when it does not play. A tap on a song does nothing yet.

type Card = { song: IndexSong; picture: string | undefined };

/** A failed read of the cache leaves the list as it is. */
const ignore = (): void => undefined;

/** The cover picture of the song as an object URL, or undefined for a song with a plain card. */
const pictureOf = async (key: FamilyKey, song: IndexSong): Promise<string | undefined> => {
  const cover = await readCover(key, song);
  return cover === null ? undefined : URL.createObjectURL(cover);
};

/**
 * The cards of the ready songs. They come from the cache when the list shows, and from each progress event of a
 * download. The object URLs of the pictures are revoked when the list closes.
 */
const readyCards = (): Accessor<readonly Card[]> => {
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
    loadCards().catch(ignore);
  });
  return cards;
};

/** A home, drawn as a house. */
const HomeIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 11.5 12 4l8 7.5V20h-5.5v-5h-5v5H4z" />
  </svg>
);

export const SongList = (props: { readonly onHome: () => void }): JSX.Element => {
  const cards = readyCards();
  onMount(() => {
    playTitleMusic();
    document.addEventListener('pointerup', playTitleMusic, { passive: true });
    onCleanup(() => document.removeEventListener('pointerup', playTitleMusic));
  });
  return (
    <main class="song-list">
      <button type="button" class="song-home" aria-label="Home" onClick={() => props.onHome()}>
        <HomeIcon />
      </button>
      <ul class="song-cards">
        <For each={cards()}>
          {(card) => (
            <li class="song-card">
              <Show when={card.picture} fallback={<div class="song-picture song-plain" />}>
                {(picture) => <img class="song-picture" src={picture()} alt="" draggable={false} />}
              </Show>
              <span class="song-title">{card.song.title}</span>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
};
