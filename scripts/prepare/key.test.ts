import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decodeKeyCode, openFamilyKey } from '../../src/model/index.ts';
import { loadKey, makeKey, readKeyCode } from './key.ts';

let root = '';
let folder = '';

const modeOf = async (path: string) => (await stat(path)).mode & 0o777;

const reasonOf = (result: { ok: true } | { ok: false; reason: string }): string => (result.ok ? 'ok' : result.reason);

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'beat-pals-key-'));
  folder = join(root, 'config', 'beat-pals');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('makeKey', () => {
  it('makes the key folder with mode 0700 and the key files with mode 0600', async () => {
    const made = await makeKey(folder);

    expect(made.ok && made.value).toMatch(/^[0-9a-f]{16}$/u);
    expect(await modeOf(folder)).toBe(0o700);
    expect(await modeOf(join(folder, 'song-key'))).toBe(0o600);
    expect(await modeOf(join(folder, 'song-key-check'))).toBe(0o600);
  });

  it('refuses to replace a key file and leaves it unchanged', async () => {
    await makeKey(folder);
    const before = await readFile(join(folder, 'song-key'), 'utf8');

    expect(reasonOf(await makeKey(folder))).toMatch(/by hand/u);
    expect(await readFile(join(folder, 'song-key'), 'utf8')).toBe(before);
  });

  it('makes another key each time', async () => {
    const one = await makeKey(folder);
    await rm(join(folder, 'song-key'));
    const two = await makeKey(folder);

    expect(one.ok && two.ok && one.value !== two.value).toBe(true);
  });
});

describe('loadKey', () => {
  it('opens the key that makeKey made, with its key check', async () => {
    const made = await makeKey(folder);
    const loaded = await loadKey(folder);

    expect(loaded.ok && made.ok && loaded.value.key.id === made.value).toBe(true);
  });

  it('tells the Parent to run key --new when no key exists', async () => {
    expect(reasonOf(await loadKey(folder))).toMatch(/prepare-song key --new/u);
  });

  it('refuses a key folder or a key file with a wider mode', async () => {
    await makeKey(folder);

    await chmod(folder, 0o755);
    expect(reasonOf(await loadKey(folder))).toMatch(/0755/u);
    await chmod(folder, 0o700);
    await chmod(join(folder, 'song-key'), 0o644);
    expect(reasonOf(await loadKey(folder))).toMatch(/0644/u);
    await chmod(join(folder, 'song-key'), 0o600);
    await chmod(join(folder, 'song-key-check'), 0o640);
    expect(reasonOf(await loadKey(folder))).toMatch(/0640/u);
  });

  it('refuses a key check of another key', async () => {
    await makeKey(folder);
    const other = join(root, 'other');
    await makeKey(other);
    await writeFile(join(folder, 'song-key-check'), await readFile(join(other, 'song-key-check')));

    expect(reasonOf(await loadKey(folder))).toMatch(/key check/u);
  });

  it('never puts the key code into a reason', async () => {
    await makeKey(folder);
    const code = (await readFile(join(folder, 'song-key'), 'utf8')).trim();
    await chmod(join(folder, 'song-key'), 0o644);
    const wide = reasonOf(await loadKey(folder));
    await chmod(join(folder, 'song-key'), 0o600);
    await writeFile(join(folder, 'song-key'), `${code}X\n`);
    const broken = reasonOf(await loadKey(folder));

    expect(broken).toMatch(/valid key code/u);
    expect([wide, broken].some((reason) => reason.includes(code.slice(0, 9)))).toBe(false);
  });
});

describe('readKeyCode', () => {
  it('gives the key code in groups of 4, and the code opens the same key', async () => {
    const made = await makeKey(folder);
    const code = await readKeyCode(folder);
    const raw = code.ok ? decodeKeyCode(code.value) : undefined;

    expect(code.ok && code.value).toMatch(/^(?:[0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{2}$/u);
    expect(raw === undefined ? undefined : (await openFamilyKey(raw)).id).toBe(made.ok && made.value);
  });
});
