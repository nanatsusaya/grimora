/**
 * The `apps/api` **sync endpoints** (#107, ADR 0005 §3, ADR 0011 §7, ADR 0024 §2) — the primary durable
 * write/read path for cloud replication. Both routes **hard-enforce actor-binding**: the caller's account
 * id comes from the verified access token (never a client claim) and is used as `owner_id` for writes and
 * the tenancy filter for reads. Each is a thin adapter over {@link SyncStore} + {@link TokenVerifier}.
 *
 * `POST /sync/push` returns **per-event** results (partial success, ADR 0011 §7); `GET /sync/pull` returns
 * the owner's events after a checkpoint. The client `SyncPort` adapter (offline-sync, slice 3) drives these.
 */

import { type AppError, appError } from '@grimora/core-domain';
import { type EventEnvelope, err, type Result } from '@grimora/shared-types';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { VerifiedActor } from '../auth/jwt';
import type { ApiComposition } from '../composition/composition-root';
import { toProblem } from '../http/problem';
import { ProblemSchema } from '../http/schemas';

/** An event envelope on the wire (ADR 0004) — mirrors `@grimora/shared-types` `EventEnvelope`. */
const EnvelopeSchema = z
  .object({
    id: z.string(),
    aggregateId: z.string(),
    aggregateType: z.string(),
    type: z.string(),
    // 1-based, strictly positive (ADR 0004 §1): a `version`/`schemaVersion` <= 0 violates the causal-stream
    // invariant, so reject it at the wire boundary rather than persisting a malformed event (audit F-15 —
    // the cheap subset of the deferred ADR 0024 §2 ingress hardening, see this ADR's 2026-07-12 amendment).
    version: z.number().int().positive(),
    schemaVersion: z.number().int().positive(),
    occurredAt: z.string(),
    payload: z.unknown(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('EventEnvelope');

/** A persisted event = an envelope plus the cloud-assigned `position`. */
const PersistedEventSchema = EnvelopeSchema.extend({ position: z.number() }).openapi(
  'PersistedEvent',
);

/** Per-event push outcome (ADR 0011 §7 partial success) — discriminated on `status`. */
const PushResultSchema = z
  .discriminatedUnion('status', [
    z.object({ id: z.string(), status: z.literal('accepted'), position: z.number() }),
    z.object({ id: z.string(), status: z.literal('duplicate') }),
    z.object({ id: z.string(), status: z.literal('conflict'), currentVersion: z.number() }),
  ])
  .openapi('PushResult');

const PushBodySchema = z.object({ events: z.array(EnvelopeSchema) });
const PushResponseSchema = z.object({ results: z.array(PushResultSchema) });
const PullResponseSchema = z.object({
  events: z.array(PersistedEventSchema),
  checkpoint: z.number(),
});

/**
 * The JSON response DTO shapes. The handlers cast their domain results (branded ids, `readonly`, `unknown`
 * payloads) to these at the serialization boundary — a legitimate adapter-edge cast: the runtime JSON is
 * identical; only the nominal/`readonly`/`unknown`-vs-`JSONValue` compile types differ (ADR 0003 §1).
 */
type PushResponse = z.infer<typeof PushResponseSchema>;
type PullResponse = z.infer<typeof PullResponseSchema>;

const pushRoute = createRoute({
  method: 'post',
  path: '/api/v1/sync/push',
  summary: 'Push a batch of events (insert-only, per-event results)',
  security: [{ Bearer: [] }],
  request: { body: { content: { 'application/json': { schema: PushBodySchema } } } },
  responses: {
    200: {
      description: 'Per-event results (accepted / duplicate / conflict).',
      content: { 'application/json': { schema: PushResponseSchema } },
    },
    401: {
      description: 'Missing or invalid access token.',
      content: { 'application/problem+json': { schema: ProblemSchema } },
    },
  },
});

const pullRoute = createRoute({
  method: 'get',
  path: '/api/v1/sync/pull',
  summary: 'Pull the owner’s events after a checkpoint',
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      since: z.coerce.number().int().nonnegative().default(0).openapi({
        description: 'exclusive lower bound — return events with position > since',
      }),
    }),
  },
  responses: {
    200: {
      description: 'The owner’s events after the checkpoint + the new checkpoint.',
      content: { 'application/json': { schema: PullResponseSchema } },
    },
    401: {
      description: 'Missing or invalid access token.',
      content: { 'application/problem+json': { schema: ProblemSchema } },
    },
  },
});

/**
 * Extract + verify the bearer access token from a request, yielding the caller's identity.
 * @param c         the Hono request context
 * @param verifier  the token verifier (JWKS-backed in production)
 * @returns         the {@link VerifiedActor}, or an `Unauthorized` `AppError` when absent/invalid
 */
async function requireActor(
  c: Context,
  verifier: ApiComposition['tokenVerifier'],
): Promise<Result<VerifiedActor, AppError>> {
  const header = c.req.header('authorization');
  const token = header?.toLowerCase().startsWith('bearer ')
    ? header.slice('bearer '.length).trim()
    : '';
  if (!token) return err(appError('auth.missing_token', 'Unauthorized'));
  return verifier.verify(token);
}

/**
 * Register the sync routes on the app.
 * @param app          the `OpenAPIHono` app
 * @param composition  the wired ports — its `syncStore` + `tokenVerifier`
 */
export function registerSyncRoutes(app: OpenAPIHono, composition: ApiComposition): void {
  // Declare the bearer scheme once so the generated OpenAPI marks these routes as protected.
  app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  app.openapi(pushRoute, async (c) => {
    const actor = await requireActor(c, composition.tokenVerifier);
    if (!actor.ok) {
      const { status, body } = toProblem(actor.error);
      c.header('content-type', 'application/problem+json');
      return c.json(body, status as 401);
    }
    const { events } = c.req.valid('json');
    // The stored `owner_id` is the verified account (ADR 0024 §2), independent of each event's own
    // `metadata.actorId` (which may be a device pseudonym pre-first-bind, ADR 0012 §13 / Reading 2). The
    // validated wire events are the domain envelopes at this trust boundary (untyped ids become branded).
    const results = await composition.syncStore.push(
      actor.value.accountId,
      events as unknown as readonly EventEnvelope[],
    );
    return c.json({ results } as unknown as PushResponse, 200);
  });

  app.openapi(pullRoute, async (c) => {
    const actor = await requireActor(c, composition.tokenVerifier);
    if (!actor.ok) {
      const { status, body } = toProblem(actor.error);
      c.header('content-type', 'application/problem+json');
      return c.json(body, status as 401);
    }
    const { since } = c.req.valid('query');
    const page = await composition.syncStore.pull(actor.value.accountId, since);
    return c.json(page as unknown as PullResponse, 200);
  });
}
