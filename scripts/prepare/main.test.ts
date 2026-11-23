import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newKeyCommand } from './main.ts';

let root = '';
let site = '';
let lines: string[] = [];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'beat-pals-main-'));
  site = join(root, 'songs', '.site');
  lines = [];
  await mkdir(site, { recursive: true });
  await writeFile(join(site, 'manifest.json'), '{}\n');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const log = (line: string) => lines.push(line);

describe('prepare-song key --new', () => {
  it('empties the song store when it makes the key in the home key folder', async () => {
    const home = join(root, 'home-key');

    expect(await newKeyCommand({ folder: home, home, site, log })).toBe(0);

    await expect(readdir(site)).rejects.toThrow();
    expect(lines[0]).toMatch(/and emptied .*\.site\.$/u);
  });

  it('leaves the song store alone with a test key folder, and says so', async () => {
    const folder = join(root, 'test-key');

    expect(await newKeyCommand({ folder, home: join(root, 'home-key'), site, log })).toBe(0);

    expect(await readdir(site)).toEqual(['manifest.json']);
    expect(lines[0]).toMatch(/did not empty .*\.site/u);
  });
});
