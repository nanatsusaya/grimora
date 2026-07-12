/**
 * Shared OpenAPI/Zod schemas reused across route modules, so a schema registered under a given
 * `.openapi(name)` is defined **once** — two modules each declaring `.openapi('Problem')` would collide in
 * the generated document. Kept separate from `app.ts` to avoid a circular import (route modules import
 * these; `app.ts` imports the route modules).
 */

import { z } from '@hono/zod-openapi';

/** RFC 9457 `application/problem+json` document as it appears in the spec (mirrors `ProblemDocument`). */
export const ProblemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    code: z.string(),
    category: z.string(),
    messageKey: z.string(),
  })
  .openapi('Problem');
