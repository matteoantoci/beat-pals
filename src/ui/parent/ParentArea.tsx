import type { JSX } from 'solid-js';

// The parent area. English text is allowed here, because only an adult gets in.
// Later tickets add the sections (spec, "Screens").

export const ParentArea = (props: { readonly onClose: () => void }): JSX.Element => (
  <main class="parent-area">
    <header class="parent-bar">
      <h1>Parent area</h1>
      <button type="button" onClick={() => props.onClose()}>
        Done
      </button>
    </header>
  </main>
);
