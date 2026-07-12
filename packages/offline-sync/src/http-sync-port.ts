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
import { type EntityId, type EventEnvelope, err, ok, type Result } from '@grimora/shared-types';

/** The `apps/api` `POST /sync/push` response body — the per-event results (mirrors {@link SyncPushResult}). */
interface PushResponseBody {
  readonly results: readonly SyncPushResult[];
}

/** The `apps/api` `GET /sync/pull` response body — the owner's events + the new checkpoint (mirrors {@link SyncPullPage}). */
interface PullResponseBody {
  readonly events: SyncPullPage['events'];
  readonly checkpoint: number;
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
      const body = (await res.json()) as PushResponseBody;
      return ok(body.results);
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
      const body = (await res.json()) as PullResponseBody;
      return ok({ events: body.events, checkpoint: body.checkpoint });
    },
  };
}
