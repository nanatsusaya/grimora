/**
 * The **implicit local identity** for the offline-first shell (ADR 0012 §13).
 *
 * On a cold start with no prior login the device *is* the user: the app must not block on authentication,
 * so we mint (or reuse) a single device-scoped identity and append every event under it. It is **not** an
 * `AuthPort` session and carries **no token** (§13, so §5 token storage is unaffected); binding to a real
 * account happens later, on first successful online login (#105-E).
 *
 * **Where it is persisted — and why `localStorage`:** §13 says "reuse if already present in the local
 * store", but leaves the mechanism open. This device id is *installation config*, not domain data, so it
 * lives in `localStorage` rather than in either SQLite store, on purpose:
 *   - **not** the read-model store — that is a rebuildable projection whose `clear()` wipes everything on
 *     a projection rebuild (ADR 0004 §5); the identity must survive that.
 *   - **not** a domain event in the event store — an implicit device pointer that §13 explicitly frames as
 *     *not* a user aggregate should not be modelled as an intention-revealing domain event, and doing so
 *     would prematurely settle an event-payload schema/classification question that ADR 0004/0023 own.
 *   - **not** a token — so ADR 0012 §5's secure-token-storage rule does not apply (there is no secret).
 * This is a deliberate, reversible skeleton choice (documented so the owner can veto). When the device
 * first logs in (#120 E4) it is **bound** to a real account — but, per the owner-approved "Reading 2"
 * (ADR 0012 §13), the device **keeps this stable local principal** rather than swapping its `userId` to the
 * account id: that preserves local ownership of pre-login characters (their events are stamped with the
 * device id, and the owner-only policy would otherwise deny the account edits to them). The binding
 * `device → account` is *recorded* (see {@link recordFirstBind}); the account attribution becomes
 * observable when the binding is applied at **sync push** (mapping device-owned streams to the account,
 * ADR 0005 §3 / PR C) and for cross-device identity — the device is "operating as that account" for all
 * account-facing purposes without rewriting immutable events (ADR 0004).
 */

import type { Actor, AuthPort, IdGeneratorPort } from '@grimora/core-domain';
import type { EntityId } from '@grimora/shared-types';

/** The `localStorage` key holding this installation's implicit identity. Namespaced to avoid collisions. */
const DEVICE_IDENTITY_KEY = 'grimora.device-identity';

/** The `localStorage` key holding this installation's first account binding (#120 E4). */
const ACCOUNT_BINDING_KEY = 'grimora.account-binding';

/** The minimal `Storage` surface these helpers need — injected so unit tests use a fake (ADR 0017). */
type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * A recorded first bind of this device's implicit identity to a real account (ADR 0012 §13). Immutable
 * once written: it is the provenance of "which account this device's pre-login local data belongs to".
 */
export interface AccountBinding {
  /** the device's implicit local identity (the stable local command principal — see the module header) */
  readonly deviceId: EntityId;
  /** the Supabase account id the device bound to on first login */
  readonly accountId: EntityId;
  /** ISO-8601 instant of the first bind — kept as provenance for the later sync attribution */
  readonly boundAt: string;
}

/**
 * Return the device's implicit local identity, creating and persisting one on first launch.
 *
 * Synchronous by design: identity must be available before the first local read/write, with no network or
 * async store round-trip on the critical path (ADR 0012 §2/§13). If `localStorage` is unavailable the call
 * throws rather than silently minting an ephemeral id — an ephemeral id would orphan the events written
 * under it, so failing loudly is the safer skeleton behaviour.
 * @param ids  the id generator used to mint a new identity on first launch (UUIDv7 in production)
 * @returns    the acting `Actor` for all offline use cases on this device
 */
export function ensureOfflineIdentity(ids: IdGeneratorPort): Actor {
  const existing = localStorage.getItem(DEVICE_IDENTITY_KEY);
  if (existing) {
    return { userId: existing as EntityId };
  }
  const userId = ids.newId();
  localStorage.setItem(DEVICE_IDENTITY_KEY, userId);
  return { userId };
}

/**
 * Read this installation's recorded account binding, or `undefined` if the device has never logged in.
 * @param storage  the key-value storage to read from (defaults to `localStorage`; injected for tests)
 * @returns        the {@link AccountBinding}, or `undefined` when unbound (the §13 pre-login state)
 */
export function getAccountBinding(
  storage: KeyValueStorage = localStorage,
): AccountBinding | undefined {
  const raw = storage.getItem(ACCOUNT_BINDING_KEY);
  return raw ? (JSON.parse(raw) as AccountBinding) : undefined;
}

/**
 * Record the **first** bind of this device to an account (ADR 0012 §13, #120 E4). Idempotent and
 * first-writer-wins: once a binding exists it is never overwritten — so a later login as a *different*
 * account on the same device does not silently re-own the device's existing local data (that multi-account
 * case is deliberately out of scope here, left to the sync/account work, PR C+). Immutable-safe: it adds a
 * mapping record, never rewriting events already stamped with the device id (ADR 0004).
 * @param deviceId   the device's implicit local identity
 * @param accountId  the account id from the first successful login
 * @param now        the ISO-8601 instant to stamp (injected clock, ADR 0004 §9)
 * @param storage    the key-value storage to persist to (defaults to `localStorage`; injected for tests)
 * @returns          the effective binding — the pre-existing one if already bound, else the newly recorded one
 */
export function recordFirstBind(
  deviceId: EntityId,
  accountId: EntityId,
  now: string,
  storage: KeyValueStorage = localStorage,
): AccountBinding {
  const existing = getAccountBinding(storage);
  if (existing) return existing;
  const binding: AccountBinding = { deviceId, accountId, boundAt: now };
  storage.setItem(ACCOUNT_BINDING_KEY, JSON.stringify(binding));
  return binding;
}

/**
 * Wire the first-bind: subscribe to the auth port so the **first** time this device has a session (a login
 * or a boot `restore()`), it records the device → account binding (ADR 0012 §13, #120 E4). The local
 * command principal is left unchanged (Reading 2 — see the module header); only the binding record is
 * written. Idempotent via {@link recordFirstBind}, so a returning/restored session re-triggers harmlessly.
 * @param auth      the client auth port to observe
 * @param deviceId  the device's implicit local identity (the bind source)
 * @param now       a clock returning the ISO-8601 instant for the bind stamp (ADR 0004 §9)
 * @param storage   the key-value storage to persist to (defaults to `localStorage`; injected for tests)
 * @returns         an unsubscribe function that detaches the listener
 */
export function bindDeviceOnFirstLogin(
  auth: AuthPort,
  deviceId: EntityId,
  now: () => string,
  storage: KeyValueStorage = localStorage,
): () => void {
  return auth.onSessionChange((session) => {
    if (session) recordFirstBind(deviceId, session.userId, now(), storage);
  });
}
