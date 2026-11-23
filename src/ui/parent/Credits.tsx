import { createResource, For, Show } from 'solid-js';
import { chartAuthors, CREDIT_GROUPS } from '../../model';
import { loadFamilyKey, readSongStore } from '../../shell/songs';
import type { CreditGroup } from '../../model';
import type { JSX } from 'solid-js';

// The credits of the parent area (spec, "Screens"; user story 48): the title music, the sound effects, and the other
// shipped files from the credits list of the model, and the chart author of each ready song. The song index holds the
// `charter` of each facts file (prepare-song copies it), so the chart authors need no decryption of a song file.

/** The chart authors of the ready songs on this device. With no key or no song store, the list is empty. */
const readyChartAuthors = async (): Promise<string[]> => {
  const key = await loadFamilyKey();
  const store = key === undefined ? undefined : await readSongStore(key);
  return chartAuthors(store?.ok === true ? store.plan.ready.map((song) => song.charter) : []);
};

const Group = (props: { readonly group: CreditGroup }): JSX.Element => {
  const { licence, entries } = props.group;
  return (
    <>
      <h3>
        <Show when={licence.url !== ''} fallback={licence.name}>
          <a href={licence.url} target="_blank" rel="noopener noreferrer">
            {licence.name}
          </a>
        </Show>
        {licence.creditRequired || licence.url === '' ? '' : ': no credit is necessary, with thanks'}
      </h3>
      <ul class="parent-credits">
        <For each={entries}>
          {(entry) => (
            <li>
              <Show when={entry.url !== ''} fallback={entry.title}>
                <a href={entry.url} target="_blank" rel="noopener noreferrer">
                  {entry.title}
                </a>
              </Show>{' '}
              by {entry.author} ({entry.kind})
              <Show when={licence.creditRequired}>
                <span class="parent-change">Change: {entry.change}</span>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </>
  );
};

const ChartAuthors = (): JSX.Element => {
  const [authors] = createResource(async () => readyChartAuthors().catch(() => []));
  return (
    <>
      <h3>Charts</h3>
      <Show when={authors()} fallback={<p>Reading the song list…</p>}>
        {(names) => (
          <Show when={names().length > 0} fallback={<p>No songs are ready on this device yet.</p>}>
            <p>The charts of the songs are by:</p>
            <ul class="parent-credits chart-authors">
              <For each={names()}>{(name) => <li>{name}</li>}</For>
            </ul>
          </Show>
        )}
      </Show>
    </>
  );
};

export const Credits = (): JSX.Element => (
  <section class="parent-section credits-section">
    <h2>Credits</h2>
    <p>Beat Pals uses this music, these sounds, and these charts. Thank you to their authors.</p>
    <For each={CREDIT_GROUPS}>{(group) => <Group group={group} />}</For>
    <ChartAuthors />
  </section>
);
