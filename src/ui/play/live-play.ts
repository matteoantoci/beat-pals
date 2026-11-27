// The live adapter of the play lifetime (play-load.ts): it reads the song files from the song store, decodes the
// song, and makes the stage on the play screen (load-parts.ts has the steps). Then the play loop starts.

import { readSongFiles } from '../../shell/songs';
import { loadSong } from '../../sound';
import { stagePorts, type PlayElements } from './fit';
import { loadParts, type LiveParts, type LivePorts, type LoadRequest } from './load-parts';
import { startPlayLoop } from './play-loop';
import type { PlayAdapter } from './play-load';

/** What a play needs: the elements of the play screen, the song, and the device storage. */
export type PlayRequest = LoadRequest & { readonly elements: PlayElements };

const readFiles: LivePorts['readFiles'] = async ({ key, song }, onBytes) => {
  const read = await readSongFiles(key, song, onBytes);
  return read.ok ? read.files : { problem: read.problem };
};

/** Loads the song of the choice and plays it at the record color and speed step of its progress. */
export const livePlay = (request: PlayRequest): PlayAdapter<LiveParts> => {
  const { root, beads } = request.elements;
  const ports: LivePorts = { ...stagePorts(request.elements), readFiles, decode: loadSong };
  return {
    load: (scope) => loadParts(request, ports, scope),
    start: (parts, calls) => startPlayLoop({ ...parts, ...calls, root, beads }),
  };
};
