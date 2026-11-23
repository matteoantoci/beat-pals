// The leak scan (spec, "Delivery", "Leak scan"): no file and no commit message in the public repository may name
// a song. It reads the song ids, titles, and artists from songs/*.sng at the repo root, and checks each text with
// the rules in scripts/lib/leaks.ts. Each file and each commit message is one text.
//
//   node scripts/leak-scan.ts staged           every file in the index (the pre-commit hook)
//   node scripts/leak-scan.ts message <file>   a new commit message (the commit-msg hook)
//   node scripts/leak-scan.ts push <remote>    the index, and every file version and message in the commits that
//                                              the remote does not have; the refs come on stdin (the pre-push hook)
//   node scripts/leak-scan.ts history          the index, and every file version and message in the history of
//                                              HEAD (before the first push, and in `deploy`)
//
// A push sends the whole history, so an old file version that names a song leaks too. So the push modes read
// every blob of the commits, not only the current files, and a leak names the commits that add the blob.
// Without a songs/ folder, the scan cannot know the names. Then the commit modes pass with a warning, and the
// push modes stop. The exit code is 0 for a pass and 1 for a leak or an error.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { findLeaks } from './lib/leaks.ts';
import { readSng } from './lib/sng.ts';
import type { SongNames } from './lib/leaks.ts';

type Text = { readonly label: string; readonly content: string; readonly sha?: string };
type Blob = { readonly sha: string; readonly path: string };

const NO_COMMIT = /^0+$/u;
const MAX_BUFFER = 2 ** 30;
const utf8 = new TextDecoder();

const git = (root: string, args: readonly string[], input?: string): Buffer =>
  execFileSync('git', args, { cwd: root, input, maxBuffer: MAX_BUFFER });

const readSongs = (root: string): SongNames[] | undefined => {
  const folder = join(root, 'songs');
  let names: string[];
  try {
    names = readdirSync(folder).filter((name) => name.endsWith('.sng'));
  } catch {
    return undefined;
  }
  return names.map((name) => {
    const { metadata } = readSng(readFileSync(join(folder, name)));
    return { id: basename(name, '.sng'), title: metadata.get('name') ?? '', artist: metadata.get('artist') ?? '' };
  });
};

/** Reads the blobs with one `git cat-file --batch`. Each text starts with its path, so a file name counts too. */
const readBlobs = (root: string, blobs: readonly Blob[]): Text[] => {
  const out = git(root, ['cat-file', '--batch'], blobs.map((blob) => blob.sha).join('\n') + '\n');
  let at = 0;
  return blobs.map(({ sha, path }) => {
    const headerEnd = out.indexOf(10, at);
    const size = Number(out.subarray(at, headerEnd).toString().split(' ')[2]);
    const content = out.subarray(headerEnd + 1, headerEnd + 1 + size);
    at = headerEnd + 1 + size + 1;
    return { label: path, content: `${path}\n${utf8.decode(content)}`, sha };
  });
};

/** Every file in the index: what the next commit holds. */
const indexBlobs = (root: string): Blob[] =>
  git(root, ['ls-files', '--stage', '-z'])
    .toString()
    .split('\0')
    .filter((entry) => entry !== '' && !entry.startsWith('160000'))
    .map((entry) => {
      const [info = '', path = ''] = entry.split('\t');
      return { sha: info.split(' ')[1] ?? '', path };
    });

/** Every file in the commits that `revs` selects, once for each content. */
const historyBlobs = (root: string, revs: readonly string[]): Blob[] =>
  git(root, ['rev-list', '--objects', '--filter=object:type=blob', ...revs])
    .toString()
    .split('\n')
    .filter((line) => line.includes(' '))
    .map((line) => ({ sha: line.slice(0, line.indexOf(' ')), path: line.slice(line.indexOf(' ') + 1) }));

const messages = (root: string, revs: readonly string[]): Text[] =>
  git(root, ['log', '-z', '--format=%h%n%B', ...revs])
    .toString()
    .split('\0')
    .filter((entry) => entry !== '')
    .map((entry) => ({ label: `message of commit ${entry.slice(0, entry.indexOf('\n'))}`, content: entry }));

/** The commits of a push: the local commits on stdin that the remote does not have yet. */
const pushRevs = (remote: string): string[] => {
  const local = readFileSync(0, 'utf8')
    .split('\n')
    .map((line) => line.split(' ')[1] ?? '')
    .filter((sha) => sha !== '' && !NO_COMMIT.test(sha));
  return local.length === 0 ? [] : [...local, '--not', `--remotes=${remote}`];
};

type Scan = { readonly texts: readonly Text[]; readonly revs: readonly string[] };

const collect = (root: string, mode: string, argument: string | undefined): Scan => {
  if (mode === 'staged') {
    return { texts: readBlobs(root, indexBlobs(root)), revs: [] };
  }
  if (mode === 'message' && argument !== undefined) {
    return { texts: [{ label: 'the new commit message', content: readFileSync(argument, 'utf8') }], revs: [] };
  }
  if ((mode === 'push' && argument !== undefined) || mode === 'history') {
    const revs = mode === 'history' ? ['HEAD'] : pushRevs(argument ?? '');
    const history = revs.length === 0 ? [] : [...readBlobs(root, historyBlobs(root, revs)), ...messages(root, revs)];
    return { texts: [...readBlobs(root, indexBlobs(root)), ...history], revs };
  }
  throw new Error('Usage: node scripts/leak-scan.ts staged | message <file> | push <remote> | history');
};

/** The commits that add or remove the blob, so that a leak in the history names its commit and its path. */
const addedIn = (root: string, sha: string, revs: readonly string[]): string => {
  const commits = git(root, ['log', '--format=%h', `--find-object=${sha}`, ...revs])
    .toString()
    .trim()
    .split('\n')
    .filter((commit) => commit !== '');
  return commits.length === 0 ? 'staged, not committed' : `added or removed in commits ${commits.join(', ')}`;
};

const main = (): number => {
  const [mode = '', argument] = process.argv.slice(2);
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).toString().trim();
  const { texts, revs } = collect(root, mode, argument);
  const songs = readSongs(root);
  if (songs === undefined) {
    const push = mode === 'push' || mode === 'history';
    console.log(
      push
        ? 'FAILED\n\nThere is no songs/ folder, so the scan cannot know the song names. Stop the push.'
        : 'ok, with a warning: there is no songs/ folder, so the scan cannot know the song names.'
    );
    return push ? 1 : 0;
  }
  const leaks = texts.flatMap((text) => {
    const found = findLeaks(text.content, songs);
    if (found.length === 0) {
      return [];
    }
    const where = text.sha === undefined || revs.length === 0 ? '' : ` (${addedIn(root, text.sha, revs)})`;
    return found.map((leak) => `  ${text.label}${where}: the ${leak.kind} "${leak.name}"`);
  });
  if (leaks.length > 0) {
    console.log(`FAILED\n\nThese texts name a song:\n${leaks.join('\n')}\n`);
    return 1;
  }
  console.log(`ok (${String(songs.length)} songs, ${String(texts.length)} texts)`);
  return 0;
};

process.exitCode = main();
