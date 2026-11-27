// The key step of the song setup (spec, "Guided song setup", step 2). The decode rules run before any request.
// Then the manifest is fetched, and the key must open its key check. A correct key is stored in IndexedDB as
// non-extractable CryptoKeys, and the raw bytes are erased.

import { decodeKeyCode, openFamilyKey, opensKeyCheck } from '../../model';
import { saveFamilyKey } from './key-store';
import { fetchManifest } from './store';
import type { FamilyKey } from '../../model';
import type { SetupSlot } from './setup';

export type KeyCheck =
  | { ok: true; key: FamilyKey }
  | { ok: false; problem: 'not-a-code' | 'network' | 'broken' | 'wrong-key'; reason: string };

/** Checks the raw key against the manifest of the site, and stores it when it opens the key check. */
const checkRawKey = async (raw: Uint8Array<ArrayBuffer>, setup: SetupSlot): Promise<KeyCheck> => {
  const manifest = await fetchManifest();
  if (!manifest.ok) {
    return manifest;
  }
  const key = await openFamilyKey(raw);
  if (!(await opensKeyCheck(key, manifest.value.keyCheck))) {
    return { ok: false, problem: 'wrong-key', reason: 'the key does not open the key check' };
  }
  await saveFamilyKey(key);
  setup.set('key');
  return { ok: true, key };
};

/** Checks the key code: first the decode rules, then the key check of the site. A correct key is stored, and the
 * setup mark in `setup` moves to the download step. */
export const checkKeyCode = async (code: string, setup: SetupSlot): Promise<KeyCheck> => {
  const raw = decodeKeyCode(code);
  if (raw === undefined) {
    return { ok: false, problem: 'not-a-code', reason: 'the code breaks a decode rule' };
  }
  return checkRawKey(raw, setup).finally(() => raw.fill(0));
};
