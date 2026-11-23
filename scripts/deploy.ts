// `pnpm run deploy` (not `pnpm deploy`, a pnpm command): builds the app on the Mac and publishes it on GitHub Pages
// (spec, "Delivery").
// 1. It stops when the work tree has changes, so the site always matches a commit.
// 2. It runs the leak scan on the index and every blob and message of the history (scripts/leak-scan.ts history).
// 3. It builds dist/ and adds an empty .nojekyll file, because Jekyll drops the files whose names start with
//    a dot or an underscore.
// 4. It commits dist/ in a temporary repo as one commit with no parent, and force-pushes it to the gh-pages branch
//    of origin. So gh-pages always has exactly one commit, and its history does not grow.
// 5. It waits until https://matteoantoci.github.io/beat-pals/ serves the main JS chunk with HTTP 200.
// The app only: the songs come with a later ticket.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

/** Commits dist/ as one commit with no parent in a temporary repo, and force-pushes it to gh-pages. */
const publish = (dist: string, remote: string, source: string): void => {
  const gitDir = mkdtempSync(join(tmpdir(), 'beat-pals-deploy-'));
  const git = (...args: string[]) => show('git', [`--git-dir=${gitDir}`, `--work-tree=${dist}`, ...args], dist);
  try {
    git('init', '-q', `--initial-branch=${BRANCH}`);
    git('add', '-A');
    git('commit', '-q', '-m', `Deploy commit ${source}`);
    git('push', '--force', remote, `HEAD:refs/heads/${BRANCH}`);
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
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
const waitForLive = async (url: string, end: number): Promise<void> => {
  const status = await probe(url);
  if (status === 200) {
    return;
  }
  if (Date.now() > end) {
    throw new Error(`No HTTP 200 for ${url} after ${String(LIVE_TIMEOUT_MS / 60_000)} minutes.`);
  }
  console.log(`deploy: the main JS chunk gives ${String(status)}, try again in ${String(POLL_MS / 1000)} s`);
  await sleep(POLL_MS);
  return waitForLive(url, end);
};

/** Builds dist/ with the .nojekyll file. Gives the path of the main JS chunk below the site root. */
const build = (root: string): string => {
  show('node_modules/.bin/vite', ['build'], root);
  writeFileSync(join(root, 'dist', '.nojekyll'), '');
  const chunk = MAIN_CHUNK.exec(readFileSync(join(root, 'dist', 'index.html'), 'utf8'))?.[1];
  if (chunk === undefined) {
    throw new Error('dist/index.html has no main JS chunk under /beat-pals/assets/.');
  }
  return chunk;
};

const main = async (): Promise<void> => {
  const root = run('git', ['rev-parse', '--show-toplevel'], process.cwd());
  if (run('git', ['status', '--porcelain'], root) !== '') {
    throw new Error('The work tree has changes. Commit them first, so that the site matches a commit.');
  }
  console.log('deploy: leak scan of the index and the history');
  show('node', ['scripts/leak-scan.ts', 'history'], root);
  const chunk = build(root);
  const source = run('git', ['rev-parse', '--short', 'HEAD'], root);
  publish(join(root, 'dist'), run('git', ['remote', 'get-url', 'origin'], root), source);
  const url = `${SITE}${chunk}`;
  console.log(`deploy: pushed ${BRANCH}. Wait for ${url}`);
  await waitForLive(url, Date.now() + LIVE_TIMEOUT_MS);
  console.log(`deploy: live at ${SITE}`);
};

try {
  await main();
} catch (error) {
  console.log(`deploy: ${error instanceof Error ? error.message : String(error)} The deploy stops.`);
  process.exitCode = 1;
}
