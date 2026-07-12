/**
 * The `apps/api` **auth proxy** routes (ADR 0009 §3, ADR 0011 §7/§9, ADR 0012 §5) — the server-side half
 * of the web auth flow. They exist because ADR 0012 §5 requires the browser's **refresh token to live in an
 * `HttpOnly` cookie**, which only a server can set: the client never talks to Supabase Auth directly. Each
 * route is a thin adapter over {@link SupabaseAuthClient} — it validates input, calls GoTrue, moves the
 * refresh token into/out of the cookie, and returns only the access token + identity to the client
 * (the refresh token is **never** in a JSON body, ADR 0012 §5).
 *
 * Scope (E2, #120): email+password sign-in, cookie-based refresh, and sign-out. The client-side `AuthPort`
 * adapter + login UI + CORS/Vite-proxy are E3; the ADR 0012 §13 first-bind is E4.
 */

import { appError } from '@grimora/core-domain';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { ApiComposition } from '../composition/composition-root';
import { toProblem } from '../http/problem';
import { ProblemSchema } from '../http/schemas';

/**
 * The refresh-cookie name. Scoped by `path` to the auth routes only (ADR 0012 §5 "scoped to the refresh
 * endpoint") so it is sent on nothing else, shrinking its exposure + the CSRF surface.
 */
const REFRESH_COOKIE = 'grimora_refresh';
/** The auth route prefix the refresh cookie is path-scoped to. */
const AUTH_PATH = '/api/v1/auth';
/** Refresh-cookie lifetime (30 days) — long-lived so a session survives reloads (the token rotates on use). */
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

/** The session payload returned to the client — access token + identity only; **never** the refresh token. */
const SessionSchema = z
  .object({
    accessToken: z.string(),
    expiresIn: z.number().int().openapi({ description: 'access-token lifetime in seconds' }),
    userId: z.string(),
  })
  .openapi('Session');

/** The sign-in request body (email+password — the E2 method). */
const SignInSchema = z
  .object({ email: z.string().email(), password: z.string().min(1) })
  .openapi('SignInRequest');

const signInRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/sign-in',
  summary: 'Sign in with email + password',
  request: { body: { content: { 'application/json': { schema: SignInSchema } } } },
  responses: {
    200: {
      description:
        'Authenticated; access token in the body, refresh token set as an HttpOnly cookie.',
      content: { 'application/json': { schema: SessionSchema } },
    },
    401: {
      description: 'Invalid credentials.',
      content: { 'application/problem+json': { schema: ProblemSchema } },
    },
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/refresh',
  summary: 'Refresh the access token using the HttpOnly refresh cookie',
  responses: {
    200: {
      description: 'A fresh access token; the rotated refresh token is re-set as the cookie.',
      content: { 'application/json': { schema: SessionSchema } },
    },
    401: {
      description: 'No or invalid refresh cookie.',
      content: { 'application/problem+json': { schema: ProblemSchema } },
    },
  },
});

const signOutRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/sign-out',
  summary: 'Sign out — revoke the session and clear the refresh cookie',
  responses: { 204: { description: 'Signed out (idempotent).' } },
});

/**
 * Register the auth-proxy routes on the app. Kept as a function (not inlined in `createApp`) so the auth
 * surface is a self-contained module and `createApp` stays a thin composition of route groups.
 * @param app          the `OpenAPIHono` app to attach the routes to
 * @param composition  the wired ports — used for its {@link SupabaseAuthClient} and cookie policy
 */
export function registerAuthRoutes(app: OpenAPIHono, composition: ApiComposition): void {
  const cookieOptions = {
    httpOnly: true,
    secure: composition.cookie.secure,
    sameSite: 'Strict' as const,
    path: AUTH_PATH,
    maxAge: REFRESH_MAX_AGE,
  };

  app.openapi(signInRoute, async (c) => {
    const { email, password } = c.req.valid('json');
    const result = await composition.auth.signInWithPassword(email, password);
    if (!result.ok) {
      const { status, body } = toProblem(result.error);
      c.header('content-type', 'application/problem+json');
      return c.json(body, status as 401);
    }
    setCookie(c, REFRESH_COOKIE, result.value.refreshToken, cookieOptions);
    return c.json(
      {
        accessToken: result.value.accessToken,
        expiresIn: result.value.expiresIn,
        userId: result.value.userId,
      },
      200,
    );
  });

  app.openapi(refreshRoute, async (c) => {
    const refreshToken = getCookie(c, REFRESH_COOKIE);
    if (!refreshToken) {
      const { status, body } = toProblem(appError('auth.no_refresh_cookie', 'Unauthorized'));
      c.header('content-type', 'application/problem+json');
      return c.json(body, status as 401);
    }
    const result = await composition.auth.refresh(refreshToken);
    if (!result.ok) {
      // The stored refresh token is invalid/expired — clear it so the client stops retrying with it.
      deleteCookie(c, REFRESH_COOKIE, { path: AUTH_PATH });
      const { status, body } = toProblem(result.error);
      c.header('content-type', 'application/problem+json');
      return c.json(body, status as 401);
    }
    // Refresh tokens rotate — re-store the new one.
    setCookie(c, REFRESH_COOKIE, result.value.refreshToken, cookieOptions);
    return c.json(
      {
        accessToken: result.value.accessToken,
        expiresIn: result.value.expiresIn,
        userId: result.value.userId,
      },
      200,
    );
  });

  app.openapi(signOutRoute, async (c) => {
    // The access token (if the client still holds one) lets GoTrue revoke server-side; either way we clear
    // the cookie so the browser session ends. Idempotent — a missing token/cookie is still a valid sign-out.
    const authHeader = c.req.header('authorization');
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice('bearer '.length).trim()
      : undefined;
    if (accessToken) await composition.auth.signOut(accessToken);
    deleteCookie(c, REFRESH_COOKIE, { path: AUTH_PATH });
    return c.body(null, 204);
  });
}
