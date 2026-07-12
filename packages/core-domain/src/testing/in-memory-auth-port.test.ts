/**
 * Behaviour tests for the in-memory {@link createInMemoryAuthPort} fake — the reference `AuthPort`
 * (ADR 0009 §3) until the real Supabase adapter lands (#120 E2). A full **cross-adapter** contract is
 * deferred to that adapter: unlike the store ports, an `AuthPort` cannot be "seeded" through its own
 * surface (there is no sign-up here), and the Supabase adapter's behaviour is dominated by network/Supabase
 * semantics a pure offline contract cannot assert — so E1 pins the fake's behaviour directly.
 */

import { describe, expect, test } from 'bun:test';
import type { EntityId } from '@grimora/shared-types';
import { createInMemoryAuthPort } from './fakes';

const ALICE = 'user-alice' as EntityId;

describe('createInMemoryAuthPort', () => {
  test('getSession is undefined before any sign-in (the ADR 0012 §13 unbound-device state)', async () => {
    const auth = createInMemoryAuthPort([
      { email: 'a@example.com', userId: ALICE, password: 'pw' },
    ]);
    expect(await auth.getSession()).toBeUndefined();
  });

  test('signIn with matching password credentials establishes the current session', async () => {
    const auth = createInMemoryAuthPort([
      { email: 'a@example.com', userId: ALICE, password: 'pw' },
    ]);
    const result = await auth.signIn({
      method: 'password',
      email: 'a@example.com',
      password: 'pw',
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.userId).toBe(ALICE);
    expect(await auth.getSession()).toEqual({ userId: ALICE });
  });

  test('signIn with matching OTP credentials works (method-agnostic union)', async () => {
    const auth = createInMemoryAuthPort([
      { email: 'a@example.com', userId: ALICE, token: '123456' },
    ]);
    const result = await auth.signIn({ method: 'otp', email: 'a@example.com', token: '123456' });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.userId).toBe(ALICE);
  });

  test('signIn with wrong credentials returns Unauthorized and leaves no session current', async () => {
    const auth = createInMemoryAuthPort([
      { email: 'a@example.com', userId: ALICE, password: 'pw' },
    ]);
    const result = await auth.signIn({
      method: 'password',
      email: 'a@example.com',
      password: 'nope',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.category).toBe('Unauthorized');
    expect(await auth.getSession()).toBeUndefined();
  });

  test('signIn for an unknown email fails uniformly (Unauthorized), never leaking which part was wrong', async () => {
    const auth = createInMemoryAuthPort([
      { email: 'a@example.com', userId: ALICE, password: 'pw' },
    ]);
    const result = await auth.signIn({
      method: 'password',
      email: 'ghost@example.com',
      password: 'pw',
    });
    expect(!result.ok && result.error.category).toBe('Unauthorized');
  });

  test('onSessionChange notifies on sign-in and sign-out; unsubscribe stops further notifications', async () => {
    const auth = createInMemoryAuthPort([
      { email: 'a@example.com', userId: ALICE, password: 'pw' },
    ]);
    const seen: (EntityId | undefined)[] = [];
    const unsubscribe = auth.onSessionChange((s) => seen.push(s?.userId));

    await auth.signIn({ method: 'password', email: 'a@example.com', password: 'pw' });
    await auth.signOut();
    unsubscribe();
    await auth.signIn({ method: 'password', email: 'a@example.com', password: 'pw' });

    // login → ALICE, logout → undefined; nothing after unsubscribe.
    expect(seen).toEqual([ALICE, undefined]);
  });

  test('signOut clears the session and is idempotent', async () => {
    const auth = createInMemoryAuthPort([
      { email: 'a@example.com', userId: ALICE, password: 'pw' },
    ]);
    await auth.signIn({ method: 'password', email: 'a@example.com', password: 'pw' });
    expect((await auth.signOut()).ok).toBe(true);
    expect(await auth.getSession()).toBeUndefined();
    // A second sign-out with no session is not an error.
    expect((await auth.signOut()).ok).toBe(true);
  });
});
