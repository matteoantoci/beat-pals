import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playStep } from './sky-motion';

// The step of the sky strip with reduced motion (play-sessions spec, "Screens and motion"): "every timed animation
// becomes a fade". The tests run in Node, so a fake of the strip keeps a record of each animated property.

/** A part of the strip. Each query gives a part, and each animation adds "<selector> <property>" to the record. */
class FakePart {
  readonly #name: string;
  readonly #record: string[];

  constructor(name: string, record: string[]) {
    this.#name = name;
    this.#record = record;
  }

  querySelector(selector: string): FakePart {
    return new FakePart(selector, this.#record);
  }

  querySelectorAll(selector: string): FakePart[] {
    return [new FakePart(selector, this.#record)];
  }

  animate(frames: readonly Keyframe[]): void {
    const properties = Object.keys(frames[0] ?? {}).filter((key) => key !== 'offset' && key !== 'easing');
    this.#record.push(...properties.map((property) => `${this.#name} ${property}`));
  }

  get offsetWidth(): number {
    return 400;
  }
}

const animatedParts = (reduce: boolean): readonly string[] => {
  const record: string[] = [];
  const strip = new FakePart('strip', record) as unknown as HTMLElement;
  playStep(strip, { from: 'day', to: 'afternoon' }, reduce);
  return record;
};

describe('the step of the sky strip', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  it('drifts the old clouds', () => {
    expect(animatedParts(false)).toContain('.sky-cloud translate');
  });

  it('only fades with reduced motion: no part moves', () => {
    expect(animatedParts(true).filter((part) => !part.endsWith(' opacity'))).toEqual([]);
  });
});
