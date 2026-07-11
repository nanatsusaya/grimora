/**
 * Guards the ADR 0028 §3 invariant: the rules-execution contract moved to `@grimora/rules-contract`, but
 * `@grimora/plugin-sdk` must keep **re-exporting** the full plugin-author surface so
 * `import { … } from '@grimora/plugin-sdk'` stays source-compatible (ADR 0025 §2 frozen surface). This
 * asserts the runtime (value) re-exports resolve through the SDK entry; the type-only re-exports are
 * exercised by every consumer's `typecheck` (a missing type re-export is a compile error there).
 */

import { describe, expect, it } from 'bun:test';
import {
  definePlugin,
  f,
  privacy,
  redacted,
  redactView,
  reveal,
  validateClassification,
} from '@grimora/plugin-sdk';

describe('plugin-sdk public surface (ADR 0028 re-export)', () => {
  it('re-exports the rules-contract runtime helpers through the SDK entry', () => {
    // Every value binding must resolve through @grimora/plugin-sdk (not be `undefined`), or a plugin's
    // `import { f } from '@grimora/plugin-sdk'` would silently break after the move.
    for (const binding of [f, privacy, redactView, redacted, reveal, validateClassification]) {
      expect(binding).toBeDefined();
    }
    expect(typeof f.const).toBe('function');
    expect(typeof privacy.personal).toBe('function');
    expect(privacy.nonPersonal).toBeDefined();
    expect(typeof redactView).toBe('function');
  });

  it('keeps its own plugin-registration helper', () => {
    expect(typeof definePlugin).toBe('function');
  });
});
