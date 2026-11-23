// `pnpm prepare-song [--only <song-id>]`: prepares the .sng files of songs/ for the game (spec, "The song
// pipeline"). The code is in scripts/prepare/.

import { allowModelImports } from './prepare/model-imports.ts';

allowModelImports();
// A dynamic import, because Node resolves all static imports before any module runs. The resolve hook must be
// in place before Node resolves the game model.
const { main } = await import('./prepare/main.ts');

process.exitCode = await main(process.argv.slice(2));
