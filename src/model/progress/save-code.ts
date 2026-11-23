// The save code of the parent area (spec, "Save"): the save data, compressed and encoded as text, in the Pile Pals
// format. The parent keeps the code to get the progress back when iOS deletes the app data, or to move it to a new
// device. The code is the JSON of `SaveData`, compressed with raw DEFLATE, in base64url (RFC 4648 §5) with no
// padding. It is not encrypted, so it shows the song ids of the device.

import { fromBase64url, toBase64url } from '../base64url';
import { restore } from './save';
import type { RestoreResult, SaveData } from './save';

const FORMAT = 'deflate-raw';

/** Sends the bytes through a compression or decompression stream. A damaged input makes the promise fail. */
const pipe = async (
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

/** The save code of one save. */
export const saveCode = async (save: SaveData): Promise<string> => {
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(save)), new CompressionStream(FORMAT));
  return toBase64url(packed);
};

/**
 * Reads a save code that the parent pasted. Spaces and line breaks in the code are ignored. It never throws: text
 * that is not a save code gives `reason: 'shape'`, and a code of an unknown schema version gives `'version'`.
 */
export const readSaveCode = async (code: string): Promise<RestoreResult> => {
  const text = code.replaceAll(/\s/gu, '');
  const packed = text === '' ? undefined : fromBase64url(text);
  if (packed === undefined) {
    return { ok: false, reason: 'shape' };
  }
  try {
    const json = new TextDecoder().decode(await pipe(packed, new DecompressionStream(FORMAT)));
    return restore(JSON.parse(json));
  } catch {
    // The decompression and JSON.parse throw on damaged text.
    return { ok: false, reason: 'shape' };
  }
};
