import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stopCue } from './cue-stop';

// A fast failure of the last-song cue (play-sessions spec, "Screens and motion"): the oops pals must be easy to see,
// so the fade-in of the scene ends before the other motions stop. The tests run in Node, so fakes of the elements
// and of their Web Animations keep a record of each play state.

class FakeAnimation {
  state: 'running' | 'paused' | 'finished' = 'running';

  pause(): void {
    this.state = 'paused';
  }

  finish(): void {
    this.state = 'finished';
  }
}

/** The root of the cue: its own fade-in, and the motion of a part inside it. */
class FakeRoot {
  readonly fadeIn = new FakeAnimation();
  readonly partMotion = new FakeAnimation();

  getAnimations(options?: { subtree?: boolean }): FakeAnimation[] {
    return options?.subtree === true ? [this.fadeIn, this.partMotion] : [this.fadeIn];
  }

  querySelectorAll(): never[] {
    return [];
  }
}

describe('the oops moment of the last-song cue', () => {
  beforeEach(() => {
    // No animation of the fakes is a CSS animation.
    vi.stubGlobal('CSSAnimation', class FakeCssAnimation extends FakeAnimation {});
  });

  it('ends the fade-in of the scene, and stops the other motions where they are', () => {
    const root = new FakeRoot();
    stopCue(root as unknown as HTMLElement, false);
    expect([root.fadeIn.state, root.partMotion.state]).toEqual(['finished', 'paused']);
  });
});
