import { describe, expect, it } from 'bun:test';
import { err, ok, type Result } from './index';

describe('Result helpers', () => {
  it('ok() wraps a value', () => {
    const r: Result<number> = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe(42);
    }
  });

  it('err() wraps an error', () => {
    const r: Result<number> = err(new Error('boom'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toBe('boom');
    }
  });
});
