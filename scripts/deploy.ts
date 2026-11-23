// `pnpm run deploy` (not `pnpm deploy`, a pnpm command): builds the app and the song store on the Mac and
// publishes them on GitHub Pages (spec, "Delivery").
// 1. It stops when the work tree has changes, so the site always matches a commit.
// 2. It runs the leak scan on the index and every blob and message of the history (scripts/leak-scan.ts history).
// 3. It runs `prepare-song`: it prepares the songs of songs/ and encrypts them into the song store, songs/.site/.
// 4. It builds dist/, adds an empty .nojekyll file (Jekyll drops the files whose names start with a dot or an
//    underscore), and copies only songs/.site/ to dist/songs/.
// 5. It runs the pre-push gate on dist/ (scripts/deploy/gate.ts). Any failure stops the deploy before the push.
// 6. It commits dist/ in a temporary repo as one commit with no parent, and force-pushes it to the gh-pages branch
//    of origin. So gh-pages always has exactly one commit, and its history does not grow.
// 7. It waits until https://matteoantoci.github.io/beat-pals/ serves the main JS chunk and the song index (one
//    .bin file) with HTTP 200.
// The key folder is ~/.config/beat-pals/, or the folder in BEAT_PALS_KEY_FOLDER, as for `prepare-song`.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSng } from './lib/sng.ts';
import { allowModelImports } from './prepare/model-imports.ts';

allowModelImports();
// Dynamic imports, because Node resolves all static imports before any module runs. The resolve hook must be in
// place before Node resolves the game model.
const { checkSite } = await import('./deploy/gate.ts');
const { HOME_KEY_FOLDER, loadKey } = await import('./prepare/key.ts');
const { readManifest } = await import('../src/model/index.ts');

const SITE = 'https://matteoantoci.github.io/beat-pals/';
const BRANCH = 'gh-pages';
/** A first GitHub Pages build can take some minutes. */
const LIVE_TIMEOUT_MS = 15 * 60_000;
const POLL_MS = 10_000;
const MAIN_CHUNK = /<script type="module"[^>]*\ssrc="\/beat-pals\/(assets\/[^"]+\.js)"/u;

const run = (command: string, args: readonly string[], cwd: string): string =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

/** Runs a command with its output on the terminal. Throws when it fails, so the deploy stops. */
const show = (command: string, args: readonly string[], cwd: string): void => {
  if (spawnSync(command, args, { cwd, stdio: 'inherit' }).status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed.`);
  }
};

const sleep = async (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Commits dist/ as one commit with no parent in a temporary repo, and force-pushes it to gh-pages. */
const publish = async (dist: string, remote: string, source: string): Promise<void> => {
  const gitDir = await mkdtemp(join(tmpdir(), 'beat-pals-deploy-'));
  const git = (...args: string[]) => show('git', [`--git-dir=${gitDir}`, `--work-tree=${dist}`, ...args], dist);
  try {
    git('init', '-q', `--initial-branch=${BRANCH}`);
    git('add', '-A');
    git('commit', '-q', '-m', `Deploy commit ${source}`);
    git('push', '--force', remote, `HEAD:refs/heads/${BRANCH}`);
  } finally {
    await rm(gitDir, { recursive: true, force: true });
  }
};

/** Fetches the URL once. Gives the HTTP status, or the network error as text. */
const probe = async (url: string): Promise<number | string> => {
  try {
    return (await fetch(url, { cache: 'no-store' })).status;
  } catch (error) {
    return String(error);
  }
};

/** Polls the URL until HTTP 200. Throws after `end`. */
const waitForLive = async (label: string, url: string, end: number): Promise<void> => {
  const status = await probe(url);
  if (status === 200) {
    console.log(`deploy: HTTP 200 for ${label}, ${url}`);
    return;
  }
  if (Date.now() > end) {
    throw new Error(`No HTTP 200 for ${url} after ${String(LIVE_TIMEOUT_MS / 60_000)} minutes.`);
  }
  console.log(`deploy: ${label} gives ${String(status)}, try again in ${String(POLL_MS / 1000)} s`);
  await sleep(POLL_MS);
  return waitForLive(label, url, end);
};

/** Builds dist/ with the .nojekyll file. Gives the path of the main JS chunk below the site root. */
const build = async (root: string): Promise<string> => {
  show('node_modules/.bin/vite', ['build'], root);
  await writeFile(join(root, 'dist', '.nojekyll'), '');
  const chunk = MAIN_CHUNK.exec(await readFile(join(root, 'dist', 'index.html'), 'utf8'))?.[1];
  if (chunk === undefined) {
    throw new Error('dist/index.html has no main JS chunk under /beat-pals/assets/.');
  }
  return chunk;
};

/** The id, title, artist, and charter of each .sng file of songs/, for the gate. */
const inboxSongs = async (songs: string) =>
  Promise.all(
    (await readdir(songs))
      .filter((name) => name.endsWith('.sng'))
      .map(async (name) => {
        const { metadata } = readSng(await readFile(join(songs, name)));
        const field = (key: string) => metadata.get(key) ?? '';
        return {
          id: name.slice(0, -'.sng'.length),
          title: field('name'),
          artist: field('artist'),
          charter: field('charter'),
        };
      })
  );

/** The SHA-256 of each file in git: the app assets that the gate allows. Git is public and passes the leak scan. */
const gitContents = async (root: string): Promise<Set<string>> => {
  const paths = run('git', ['ls-files', '-z'], root)
    .split('\0')
    .filter((path) => path !== '');
  return new Set(await Promise.all(paths.map(async (path) => sha256(await readFile(join(root, path))))));
};

/** Runs the pre-push gate on dist/. Throws on any failure. Gives the name of the song index file. */
const gate = async (root: string): Promise<string> => {
  const key = await loadKey(process.env['BEAT_PALS_KEY_FOLDER'] ?? HOME_KEY_FOLDER);
  if (!key.ok) {
    throw new Error(key.reason);
  }
  const dist = join(root, 'dist');
  const failures = await checkSite({
    dist,
    key: key.value.key,
    songs: await inboxSongs(join(root, 'songs')),
    appAssets: await gitContents(root),
  });
  if (failures.length > 0) {
    console.log(`deploy: the pre-push gate FAILED\n${failures.map((failure) => `  ${failure}`).join('\n')}`);
    throw new Error('The pre-push gate failed, so nothing is pushed.');
  }
  const manifest = readManifest(await readFile(join(dist, 'songs', 'manifest.json'), 'utf8'));
  if (!manifest.ok) {
    throw new Error(manifest.reason);
  }
  console.log(`deploy: the pre-push gate passed (${String(manifest.value.files.length)} store files).`);
  return manifest.value.index;
};

const main = async (): Promise<void> => {
  const root = run('git', ['rev-parse', '--show-toplevel'], process.cwd());
  if (run('git', ['status', '--porcelain'], root) !== '') {
    throw new Error('The work tree has changes. Commit them first, so that the site matches a commit.');
  }
  console.log('deploy: leak scan of the index and the history');
  show('node', ['scripts/leak-scan.ts', 'history'], root);
  console.log('deploy: prepare-song');
  show('node', ['scripts/prepare-song.ts'], root);
  const chunk = await build(root);
  await cp(join(root, 'songs', '.site'), join(root, 'dist', 'songs'), { recursive: true });
  const index = await gate(root);
  const source = run('git', ['rev-parse', '--short', 'HEAD'], root);
  await publish(join(root, 'dist'), run('git', ['remote', 'get-url', 'origin'], root), source);
  console.log(`deploy: pushed ${BRANCH}.`);
  const end = Date.now() + LIVE_TIMEOUT_MS;
  await waitForLive('the main JS chunk', `${SITE}${chunk}`, end);
  await waitForLive('the song index', `${SITE}songs/${index}.bin`, end);
  console.log(`deploy: live at ${SITE}`);
};

try {
  await main();
} catch (error) {
  console.log(`deploy: ${error instanceof Error ? error.message : String(error)} The deploy stops.`);
  process.exitCode = 1;
}
