/**
 * The **client-side `AuthPort` adapter** (#120 E3) — the browser half of the auth flow. It implements the
 * core-domain `AuthPort` (ADR 0009 §3) by calling the `apps/api` **auth proxy** (`/api/v1/auth/*`, #120 E2)
 * over same-origin `fetch` (the Vite dev proxy makes `apps/api` same-origin, so the `HttpOnly` refresh
 * cookie is first-party — ADR 0012 §5). The client never talks to Supabase Auth directly.
 *
 * **Token storage (ADR 0012 §5):** the access token lives **only in memory** (this module's closure) and is
 * never written to `localStorage`/`sessionStorage` (§11) — a reload drops it, but the `HttpOnly` refresh
 * cookie survives, so {@link HttpAuthPort.restore} silently re-establishes the session on boot. The refresh
 * token is never readable by this code at all (it lives only in the cookie the server sets).
 */

import {
  type AppError,
  type AuthCredentials,
  type AuthPort,
  type AuthSession,
  appError,
} from '@grimora/core-domain';
import { type EntityId, err, ok, type Result } from '@grimora/shared-types';

/** The `apps/api` auth-proxy response body — access token + identity only (never the refresh token). */
interface SessionResponse {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly userId: string;
}

/**
 * An {@link AuthPort} plus `restore()`, the boot-time session recovery that is not part of the port itself
 * (it exists only because a browser reload drops the in-memory access token — ADR 0012 §5).
 */
export interface HttpAuthPort extends AuthPort {
  /**
   * Attempt to re-establish a session from the `HttpOnly` refresh cookie (called once at composition-root
   * boot). Succeeds silently if the cookie is valid; a no-op if there is none (the §13 unbound state).
   * @returns resolves once the refresh attempt has completed (session set or left absent)
   */
  restore(): Promise<void>;
}

/**
 * Build the HTTP `AuthPort` adapter.
 * @param options            optional overrides
 * @param options.fetch      the `fetch` implementation (injected so tests use a fake — ADR 0017); defaults
 *                           to the global `fetch`
 * @param options.basePath   the auth-proxy base path; defaults to `/api/v1/auth` (proxied to `apps/api`)
 * @returns                  the wired {@link HttpAuthPort}
 */
export function createHttpAuthPort(
  options: { readonly fetch?: typeof fetch; readonly basePath?: string } = {},
): HttpAuthPort {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const basePath = options.basePath ?? '/api/v1/auth';

  // In-memory only (ADR 0012 §5) — never persisted to web storage.
  let accessToken: string | undefined;
  let session: AuthSession | undefined;
  const listeners = new Set<(next: AuthSession | undefined) => void>();
  const notify = (): void => {
    for (const listener of listeners) listener(session);
  };

  /** Adopt a proxy session response as the current session and notify subscribers. */
  const adopt = (data: SessionResponse): AuthSession => {
    accessToken = data.accessToken;
    session = { userId: data.userId as EntityId };
    notify();
    return session;
  };

  /** Clear the in-memory session + token and notify subscribers. */
  const clear = (): void => {
    accessToken = undefined;
    session = undefined;
    notify();
  };

  return {
    async signIn(credentials: AuthCredentials): Promise<Result<AuthSession, AppError>> {
      if (credentials.method !== 'password') {
        // E2/E3 support email+password only; OTP/OAuth are additive later (the union already allows them).
        return err(appError('auth.method_unsupported', 'Validation'));
      }
      let res: Response;
      try {
        res = await doFetch(`${basePath}/sign-in`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });
      } catch {
        return err(appError('auth.upstream_unreachable', 'Infrastructure'));
      }
      if (!res.ok) return err(appError('auth.invalid_credentials', 'Unauthorized'));
      return ok(adopt((await res.json()) as SessionResponse));
    },

    async signOut(): Promise<Result<void, AppError>> {
      // Send the access token so the proxy can revoke server-side; the cookie clears regardless. Best-effort.
      try {
        await doFetch(`${basePath}/sign-out`, {
          method: 'POST',
          credentials: 'include',
          headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
        });
      } catch {
        // Ignore: local sign-out (clearing the in-memory session) must succeed even if the network fails.
      }
      clear();
      return ok(undefined);
    },

    async getSession(): Promise<AuthSession | undefined> {
      return session;
    },

    onSessionChange(listener: (next: AuthSession | undefined) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async restore(): Promise<void> {
      let res: Response;
      try {
        res = await doFetch(`${basePath}/refresh`, { method: 'POST', credentials: 'include' });
      } catch {
        // Offline / proxy down at boot — stay unauthenticated (the §13 local identity still works).
        return;
      }
      if (res.ok) adopt((await res.json()) as SessionResponse);
      // A 401 means no valid refresh cookie → simply no session to restore.
    },
  };
}
