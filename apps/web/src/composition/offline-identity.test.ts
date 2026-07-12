/**
 * Unit tests for the ADR 0012 §13 **first-bind** (#120 E4): recording the device → account binding on the
 * first login, first-writer-wins, and driven off the auth port's `onSessionChange`. Storage + auth are
 * injected fakes (ADR 0017) so these run without a DOM/`localStorage` — the browser wiring is covered by
 * the gated auth-journey e2e. (`ensureOfflineIdentity` itself uses raw `localStorage` and is covered there.)
 */

import { describe, expect, test } from 'bun:test';
import type { AuthPort, AuthSession } from '@grimora/core-domain';
import { type EntityId, ok } from '@grimora/shared-types';
import { bindDeviceOnFirstLogin, getAccountBinding, recordFirstBind } from './offline-identity';

/** An in-memory `Storage` stand-in exposing only what the binding helpers use. */
function fakeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

/** A minimal `AuthPort` whose `emit` drives `onSessionChange` — exactly the surface first-bind observes. */
function fakeAuth(): { readonly port: AuthPort; emit(session: AuthSession | undefined): void } {
  const listeners = new Set<(session: AuthSession | undefined) => void>();
  const port: AuthPort = {
    async signIn() {
      return ok({ userId: 'unused' as EntityId });
    },
    async signOut() {
      return ok(undefined);
    },
    async getSession() {
      return undefined;
    },
    onSessionChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    port,
    emit(session) {
      for (const listener of listeners) listener(session);
    },
  };
}

const DEVICE = 'device-1' as EntityId;
const ACCOUNT_A = 'account-A' as EntityId;
const ACCOUNT_B = 'account-B' as EntityId;

describe('account binding (first-bind, ADR 0012 §13)', () => {
  test('getAccountBinding is undefined when the device has never bound', () => {
    expect(getAccountBinding(fakeStorage())).toBeUndefined();
  });

  test('recordFirstBind persists a binding that round-trips', () => {
    const storage = fakeStorage();
    const binding = recordFirstBind(DEVICE, ACCOUNT_A, '2026-07-12T00:00:00.000Z', storage);
    expect(binding).toEqual({
      deviceId: DEVICE,
      accountId: ACCOUNT_A,
      boundAt: '2026-07-12T00:00:00.000Z',
    });
    expect(getAccountBinding(storage)).toEqual(binding);
  });

  test('recordFirstBind is first-writer-wins (a second bind never overwrites the first)', () => {
    const storage = fakeStorage();
    recordFirstBind(DEVICE, ACCOUNT_A, 't1', storage);
    const second = recordFirstBind(DEVICE, ACCOUNT_B, 't2', storage);
    expect(second.accountId).toBe(ACCOUNT_A);
    expect(getAccountBinding(storage)?.accountId).toBe(ACCOUNT_A);
  });

  test('bindDeviceOnFirstLogin records the binding on the first session', () => {
    const storage = fakeStorage();
    const { port, emit } = fakeAuth();
    bindDeviceOnFirstLogin(port, DEVICE, () => '2026-07-12T00:00:00.000Z', storage);

    emit({ userId: ACCOUNT_A }); // first login

    const binding = getAccountBinding(storage);
    expect(binding?.deviceId).toBe(DEVICE);
    expect(binding?.accountId).toBe(ACCOUNT_A);
  });

  test('bindDeviceOnFirstLogin ignores sign-out and keeps the first account across a re-login', () => {
    const storage = fakeStorage();
    const { port, emit } = fakeAuth();
    bindDeviceOnFirstLogin(port, DEVICE, () => 'ts', storage);

    emit({ userId: ACCOUNT_A }); // first login → bind A
    emit(undefined); // sign out — no binding change
    emit({ userId: ACCOUNT_B }); // re-login as a different account — must NOT re-own the device

    expect(getAccountBinding(storage)?.accountId).toBe(ACCOUNT_A);
  });

  test('the unsubscribe returned by bindDeviceOnFirstLogin stops further binding', () => {
    const storage = fakeStorage();
    const { port, emit } = fakeAuth();
    const unsubscribe = bindDeviceOnFirstLogin(port, DEVICE, () => 'ts', storage);

    unsubscribe();
    emit({ userId: ACCOUNT_A });

    expect(getAccountBinding(storage)).toBeUndefined();
  });
});
