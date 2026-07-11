/**
 * The `apps/api` HTTP application (ADR 0027 §2/§3/§4): a code-first **Hono** app whose routes are typed
 * with Zod via `@hono/zod-openapi`, from which the **OpenAPI 3.1 document is generated** (ADR 0011 §2 —
 * the published spec stays the SSOT; the typed routes are the single internal source).
 *
 * Each route is a **thin inbound adapter**: it validates input against its schema, calls a wired port /
 * use case, maps a domain error through `toProblem` (ADR 0011 §4), and returns a DTO — no business logic,
 * no domain objects on the wire (ADR 0003 §1, ADR 0011 §1).
 *
 * **Scaffold scope (ADR 0027 R3):** two representative endpoints — a liveness `GET /health` and a
 * master-data read `GET /api/v1/rule-systems/{id}` (the plugin catalog, ADR 0011 §1.5/§6) — plus the
 * generated OpenAPI doc. They validate the framework + structure choices with running code; the full
 * endpoint surface (sync, AI, auth) is trigger-gated to Phase 3+ (ADR 0014 §3).
 */

import { appError } from '@grimora/core-domain';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { ApiComposition } from './composition/composition-root';
import { toProblem } from './http/problem';

/** Liveness response — no domain data, just proof the process serves requests. */
const HealthSchema = z.object({ status: z.literal('ok') }).openapi('Health');

/** The read DTO for a rule system — a projection of the plugin catalog, never the raw definition. */
const RuleSystemSchema = z
  .object({
    id: z.string().openapi({ example: 'dsa5' }),
    traitCount: z.number().int().openapi({ example: 8 }),
    checkCount: z.number().int().openapi({ example: 1 }),
    plugin: z
      .object({ pluginId: z.string(), pluginVersion: z.string() })
      .optional()
      .openapi({ description: 'provenance of the plugin that contributed this rule system' }),
  })
  .openapi('RuleSystem');

/** RFC 9457 problem document as it appears in the OpenAPI spec (mirrors `ProblemDocument`). */
const ProblemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    code: z.string(),
    category: z.string(),
    messageKey: z.string(),
  })
  .openapi('Problem');

/** `GET /health` — liveness check. */
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  summary: 'Liveness check',
  responses: {
    200: {
      description: 'The service is up.',
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
});

/** `GET /api/v1/rule-systems/{id}` — read one rule system from the plugin catalog. */
const ruleSystemRoute = createRoute({
  method: 'get',
  path: '/api/v1/rule-systems/{id}',
  summary: 'Get a rule system (plugin catalog read)',
  request: {
    params: z.object({
      id: z.string().openapi({ param: { name: 'id', in: 'path' }, example: 'dsa5' }),
    }),
  },
  responses: {
    200: {
      description: 'The rule system summary.',
      content: { 'application/json': { schema: RuleSystemSchema } },
    },
    404: {
      description: 'No such rule system is loaded.',
      content: { 'application/problem+json': { schema: ProblemSchema } },
    },
  },
});

/**
 * Build the HTTP application over a wired composition.
 * @param composition  the wired ports (see `composition/composition-root.ts`)
 * @returns            the `OpenAPIHono` app (its `.fetch` is served by the runtime; `.request` drives tests)
 */
export function createApp(composition: ApiComposition): OpenAPIHono {
  const app = new OpenAPIHono();

  app.openapi(healthRoute, (c) => c.json({ status: 'ok' as const }, 200));

  app.openapi(ruleSystemRoute, (c) => {
    const { id } = c.req.valid('param');
    const ruleSystem = composition.rules.getRuleSystem(id);
    if (!ruleSystem) {
      const { status, body } = toProblem(appError('rule_system.not_found', 'NotFound'));
      // problem+json per ADR 0011 §4; the not-found branch is always 404 (typed literal for the route).
      c.header('content-type', 'application/problem+json');
      return c.json(body, status as 404);
    }
    const plugin = composition.rules.getProvenance(id);
    return c.json(
      {
        id: ruleSystem.id,
        traitCount: ruleSystem.traits.length,
        checkCount: ruleSystem.checks.length,
        plugin,
      },
      200,
    );
  });

  // The generated OpenAPI 3.1 document — the published contract SSOT (ADR 0011 §2, ADR 0027 §3).
  app.doc('/api/v1/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Grimora API', version: '0.0.0' },
  });

  return app;
}
