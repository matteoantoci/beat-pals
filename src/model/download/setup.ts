// The steps of the guided song setup (spec, "Guided song setup"): install, key, download, and done. The shell
// stores the step that the setup reached on the device (`beat-pals:setup`). The section of the parent area shows
// the step from that mark, the key in storage, and the display mode of the app.

/** The stored mark of the setup: the key is OK, a download started, or one download is complete. */
export type SetupMark = 'key' | 'started' | 'done';

/** The view of the "Songs" section. `stopped`: the download step with "Download stopped. Tap to continue." */
export type SetupStep = 'install' | 'key' | 'download' | 'stopped' | 'done';

type SetupFacts = {
  /** The app runs from the Home Screen, not in a Safari tab. */
  readonly standalone: boolean;
  /** A family key is stored on the device. */
  readonly hasKey: boolean;
  readonly mark: SetupMark | undefined;
};

const MARKS: readonly string[] = ['key', 'started', 'done'] satisfies SetupMark[];

const isMark = (text: string): text is SetupMark => MARKS.includes(text);

/** The mark from its stored text. A missing or unknown text is no mark. */
export const readSetupMark = (text: string | null): SetupMark | undefined =>
  text !== null && isMark(text) ? text : undefined;

/**
 * The step to show. The setup is done when a key is stored and one complete download exists. Before that, a Safari
 * tab shows only the install step, because a Safari tab has separate storage.
 */
export const setupStep = ({ standalone, hasKey, mark }: SetupFacts): SetupStep => {
  if (hasKey && mark === 'done') {
    return 'done';
  }
  if (!standalone) {
    return 'install';
  }
  if (!hasKey) {
    return 'key';
  }
  return mark === 'started' ? 'stopped' : 'download';
};
