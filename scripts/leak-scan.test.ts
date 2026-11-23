// Runs the leak scan in a new git repo with an invented songs/ folder. Every song name here is invented
// (CLAUDE.md, "Public repository, private songs"). The test never reads the songs/ folder of this repo.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSng } from './lib/sng-fixture.ts';

const SCAN = join(import.meta.dirname, 'leak-scan.ts');
const MASK = new Uint8Array(16).fill(0x5a);
const ZERO = '0'.repeat(40);
/** Without the GIT_ variables: in a hook, git sets GIT_INDEX_FILE and others for the outer repo. */
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));

let repo = '';

const git = (...args: string[]): string =>
  execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: repo, env, encoding: 'utf8' }).trim();

const commit = (message: string, files: Record<string, string> = {}): string => {
  for (const [path, content] of Object.entries(files)) {
    writeFileSync(join(repo, path), content);
  }
  git('add', '-A');
  git('commit', '--allow-empty', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
};

const scan = (args: readonly string[], input = '') => {
  const run = spawnSync('node', [SCAN, ...args], { cwd: repo, env, input, encoding: 'utf8' });
  return { passed: run.status === 0, output: run.stdout + run.stderr };
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'leak-scan-'));
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  mkdirSync(join(repo, 'songs'));
  writeFileSync(
    join(repo, 'songs', 'velvet-otters--marmalade.sng'),
    buildSng(
      [
        ['name', '<color=#FFAA00>Marmalade</color>'],
        ['artist', 'Velvet Otters'],
      ],
      [],
      MASK
    )
  );
  commit('Start the project', { '.gitignore': 'songs/\n', 'README.md': 'A game.\n' });
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('leak scan', () => {
  it('passes a clean repo in every mode', () => {
    writeFileSync(join(repo, 'message.txt'), 'Add the title screen\n');

    expect(scan(['staged']).passed).toBe(true);
    expect(scan(['message', 'message.txt']).passed).toBe(true);
    expect(scan(['history']).passed).toBe(true);
  });

  it('stops a staged file that names a song, with the name from the .sng metadata', () => {
    writeFileSync(join(repo, 'notes.txt'), 'Marmalade by Velvet Otters\n');
    git('add', 'notes.txt');

    const result = scan(['staged']);

    expect(result.passed).toBe(false);
    expect(result.output).toContain('notes.txt: the title "Marmalade"');
  });

  it('stops a new commit message that names a song', () => {
    writeFileSync(join(repo, 'message.txt'), 'Tune the chart of velvet-otters--marmalade\n');

    expect(scan(['message', 'message.txt']).passed).toBe(false);
  });

  it('finds an old commit message and a removed file in the history', () => {
    commit('Add the velvet otters notes', { 'notes.txt': 'A clean note.\n' });
    const added = commit('Add a clean file', { 'old.txt': 'Marmalade by Velvet Otters\n' });
    commit('Remove the old file', { 'old.txt': 'Clean now.\n' });

    const result = scan(['history']);

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/message of commit \w+: the artist "Velvet Otters"/u);
    expect(result.output).toMatch(/old\.txt \(added or removed in commits [\w, ]+\): the title "Marmalade"/u);
    expect(result.output).toContain(added.slice(0, 7));
  });

  it('checks only the commits that the remote does not have at a push', () => {
    const old = commit('Mention the velvet otters');
    git('update-ref', 'refs/remotes/origin/master', old);
    const clean = commit('Add a clean file', { 'clean.txt': 'Clean.\n' });

    expect(scan(['push', 'origin'], `refs/heads/master ${clean} refs/heads/master ${old}\n`).passed).toBe(true);

    git('update-ref', '-d', 'refs/remotes/origin/master');

    expect(scan(['push', 'origin'], `refs/heads/master ${clean} refs/heads/master ${ZERO}\n`).passed).toBe(false);
  });

  it('lets a commit go on with a warning, but stops a push, when the songs folder is missing', () => {
    rmSync(join(repo, 'songs'), { recursive: true });

    const staged = scan(['staged']);

    expect(staged.passed).toBe(true);
    expect(staged.output).toContain('warning');
    expect(scan(['history']).passed).toBe(false);
  });
});
