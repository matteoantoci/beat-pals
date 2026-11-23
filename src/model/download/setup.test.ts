import { describe, expect, it } from 'vitest';
import { readSetupMark, setupStep } from '../index';

describe('setupStep', () => {
  it('asks for the key when no key is stored in the Home Screen app', () => {
    expect(setupStep({ standalone: true, hasKey: false, mark: undefined })).toBe('key');
  });

  it('shows the install step in a Safari tab, and hides the next steps', () => {
    expect(setupStep({ standalone: false, hasKey: false, mark: undefined })).toBe('install');
    expect(setupStep({ standalone: false, hasKey: true, mark: 'key' })).toBe('install');
    expect(setupStep({ standalone: false, hasKey: true, mark: 'started' })).toBe('install');
  });

  it('shows the download step when a key is stored and no download started', () => {
    expect(setupStep({ standalone: true, hasKey: true, mark: 'key' })).toBe('download');
    expect(setupStep({ standalone: true, hasKey: true, mark: undefined })).toBe('download');
  });

  it('shows the stopped download when a download started but is not complete', () => {
    expect(setupStep({ standalone: true, hasKey: true, mark: 'started' })).toBe('stopped');
  });

  it('is done when a key is stored and one complete download exists', () => {
    expect(setupStep({ standalone: true, hasKey: true, mark: 'done' })).toBe('done');
    expect(setupStep({ standalone: false, hasKey: true, mark: 'done' })).toBe('done');
  });

  it('asks for the key again when the key is gone, also after a complete download', () => {
    expect(setupStep({ standalone: true, hasKey: false, mark: 'done' })).toBe('key');
    expect(setupStep({ standalone: false, hasKey: false, mark: 'done' })).toBe('install');
  });
});

describe('readSetupMark', () => {
  it('reads each stored step', () => {
    expect(readSetupMark('key')).toBe('key');
    expect(readSetupMark('started')).toBe('started');
    expect(readSetupMark('done')).toBe('done');
  });

  it('gives no step for a missing or unknown value', () => {
    expect(readSetupMark(null)).toBeUndefined();
    expect(readSetupMark('')).toBeUndefined();
    expect(readSetupMark('toString')).toBeUndefined();
  });
});
