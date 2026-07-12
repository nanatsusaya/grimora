/**
 * The **client-side `SyncPort` adapter** (#107 slice 3, ADR 0005 §3/§8) — the browser half of cloud
 * replication. It implements the core-domain `SyncPort` by calling the `apps/api` **sync endpoints**
 * (`/api/v1/sync/{push,pull}`, #107 slice 2) over `fetch`, and is the deliberate swap point (ADR 0005 §8):
 * a custom HTTP transport today, PowerSync/Electric conceivable later — nothing above the port changes.
 *
 * **Transport only** (matching the port contract): it moves event envelopes over the wire and maps the
 * per-event results back; it does **not** orchestrate the domain rebase on a `conflict` — that is the
 * {@link createSyncService} layer's job (ADR 0005 §4). Both endpoints require a **Bearer access token**
 * (ADR 0024 §2 actor-binding): the token is read *per request* from an injected getter (never stored here),
 * so a token that changes across a refresh is always current, and the access token stays in the auth
 * adapter's memory-only closure (ADR 0012 §5) rather than being copied into this module.
 */

import {
  type AppError,
  appError,
  type SyncPort,
  type SyncPullPage,
  type SyncPushResult,
} from '@grimora/core-domain';
import {
  type EntityId,
  type EventEnvelope,
  err,
  ok,
  type PersistedEvent,
  type Result,
} from '@grimora/shared-types';

/** True for a non-empty string — the shape guard the wire validators use for ids/types/timestamps. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** True for a real (finite) number — rejects `NaN`/`Infinity` that `JSON.parse` can never produce but a hostile body could still claim via non-JSON. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate + narrow a `POST /sync/push` response body into per-event results (audit F-09, #188). A `200`
 * with a missing/renamed field, a non-array `results`, or an unknown `status` returns `undefined` so the
 * caller maps it to an `AppError` — a corrupt body must never be cast blindly into the domain and carried
 * toward persistence.
 * @param raw  the parsed JSON body (untrusted)
 * @returns    the validated results, or `undefined` if the body does not match the wire contract
 */
function parsePushResults(raw: unknown): readonly SyncPushResult[] | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results)) return undefined;
  const out: SyncPushResult[] = [];
  for (const item of results) {
    if (typeof item !== 'object' || item === null) return undefined;
    const id = (item as { id?: unknown }).id;
    const status = (item as { status?: unknown }).status;
    if (!isNonEmptyString(id)) return undefined;
    if (status === 'accepted') {
      const position = (item as { position?: unknown }).position;
      if (!isFiniteNumber(position)) return undefined;
      out.push({ id: id as EntityId, status: 'accepted', position });
    } else if (status === 'duplicate') {
      out.push({ id: id as EntityId, status: 'duplicate' });
    } else if (status === 'conflict') {
      const currentVersion = (item as { currentVersion?: unknown }).currentVersion;
      if (!isFiniteNumber(currentVersion)) return undefined;
      out.push({ id: id as EntityId, status: 'conflict', currentVersion });
    } else {
      return undefined; // unknown status
    }
  }
  return out;
}

/** Validate one persisted event on the wire — the envelope fields the local `replicate` relies on plus the cloud `position`. */
function isPersistedEvent(raw: unknown): raw is PersistedEvent {
  if (typeof raw !== 'object' || raw === null) return false;
  const e = raw as Record<string, unknown>;
  return (
    isNonEmptyString(e.id) &&
    isNonEmptyString(e.aggregateId) &&
    isNonEmptyString(e.aggregateType) &&
    isNonEmptyString(e.type) &&
    isFiniteNumber(e.version) &&
    isFiniteNumber(e.schemaVersion) &&
    isNonEmptyString(e.occurredAt) &&
    isFiniteNumber(e.position) &&
    'payload' in e
  );
}

/**
 * Validate + narrow a `GET /sync/pull` response body into a page (audit F-09, #188). Rejects a non-array
 * `events`, a negative/non-numeric `checkpoint`, or any event that is not a well-formed persisted event —
 * so a malformed page never reaches the local `replicate`.
 * @param raw  the parsed JSON body (untrusted)
 * @returns    the validated page, or `undefined` if the body does not match the wire contract
 */
function parsePullPage(
  raw: unknown,
): { readonly events: readonly PersistedEvent[]; readonly checkpoint: number } | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const events = (raw as { events?: unknown }).events;
  const checkpoint = (raw as { checkpoint?: unknown }).checkpoint;
  if (!Array.isArray(events)) return undefined;
  if (!isFiniteNumber(checkpoint) || checkpoint < 0) return undefined;
  for (const event of events) if (!isPersistedEvent(event)) return undefined;
  return { events: events as readonly PersistedEvent[], checkpoint };
}

/**
 * Build the HTTP `SyncPort` adapter.
 * @param options                 wiring for the adapter
 * @param options.getAccessToken  reads the current Supabase access token (or `undefined` when signed out);
 *                                called on every request so a post-refresh token is always the live one.
 *                                The caller (composition root) sources it from the auth adapter, keeping the
 *                                token in that adapter's memory-only closure (ADR 0012 §5)
 * @param options.fetch           the `fetch` implementation (injected so tests use a fake — ADR 0017);
 *                                defaults to the global `fetch`
 * @param options.basePath        the sync endpoints' base path; defaults to `/api/v1/sync` (proxied to
 *                                `apps/api`, same-origin via the Vite dev proxy — see `apps/web` E3a)
 * @returns                       the wired {@link SyncPort}
 */
export function createHttpSyncPort(options: {
  readonly getAccessToken: () => string | undefined;
  readonly fetch?: typeof fetch;
  readonly basePath?: string;
}): SyncPort {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const basePath = options.basePath ?? '/api/v1/sync';

  /**
   * Build the request headers, attaching the Bearer token when a session exists. A missing token is left
   * to the server to reject (`401`), which both methods translate to an `Unauthorized` `AppError` — the
   * one place the signed-out state surfaces, so the orchestrator can simply not sync until logged in.
   */
  const authHeaders = (base: Record<string, string>): Record<string, string> => {
    const token = options.getAccessToken();
    return token ? { ...base, authorization: `Bearer ${token}` } : base;
  };

  return {
    async push(
      events: readonly EventEnvelope[],
    ): Promise<Result<readonly SyncPushResult[], AppError>> {
      // An empty batch never hits the network — nothing to replicate, and the server would just echo `[]`.
      if (events.length === 0) return ok([]);
      let res: Response;
      try {
        res = await doFetch(`${basePath}/push`, {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({ events }),
        });
      } catch {
        // Offline / proxy down — a whole-request transport failure (distinct from a per-event conflict),
        // so the caller keeps every event pending and retries later (ADR 0011 §7).
        return err(appError('sync.upstream_unreachable', 'Infrastructure'));
      }
      if (res.status === 401) return err(appError('sync.unauthorized', 'Unauthorized'));
      if (!res.ok) return err(appError('sync.push_failed', 'Infrastructure'));
      // Parse + validate the success body in the error channel (audit F-09): invalid JSON (e.g. a proxy's
      // HTML error page under a 200) throws from `res.json()`, and a wrong shape fails validation — both map
      // to an `AppError` rather than escaping as an exception (ADR 0009 §1) or being cast blindly.
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        return err(appError('sync.malformed_response', 'Infrastructure'));
      }
      const results = parsePushResults(body);
      if (!results) return err(appError('sync.malformed_response', 'Infrastructure'));
      return ok(results);
    },

    async pull(
      sincePosition: number,
      // The server does not yet support per-stream routing (ADR 0024 §4) — it returns all of the owner's
      // events after the checkpoint. The parameter is accepted to honour the port shape; wiring it through
      // is a later refinement, so ignoring it here is safe (a superset, never a missing-event, result).
      _streams?: readonly EntityId[],
    ): Promise<Result<SyncPullPage, AppError>> {
      let res: Response;
      try {
        res = await doFetch(`${basePath}/pull?since=${sincePosition}`, {
          method: 'GET',
          credentials: 'include',
          headers: authHeaders({}),
        });
      } catch {
        return err(appError('sync.upstream_unreachable', 'Infrastructure'));
      }
      if (res.status === 401) return err(appError('sync.unauthorized', 'Unauthorized'));
      if (!res.ok) return err(appError('sync.pull_failed', 'Infrastructure'));
      // Same as push: a malformed/invalid page becomes an `AppError`, never a thrown parse error or a blind
      // cast — a corrupt page must not reach the local `replicate` (audit F-09).
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        return err(appError('sync.malformed_response', 'Infrastructure'));
      }
      const page = parsePullPage(body);
      if (!page) return err(appError('sync.malformed_response', 'Infrastructure'));
      return ok(page);
    },
  };
}
