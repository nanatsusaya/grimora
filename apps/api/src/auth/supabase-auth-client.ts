/**
 * A thin server-side client for **Supabase Auth (GoTrue)** — the outbound adapter the `apps/api` auth
 * proxy uses to authenticate against Supabase (ADR 0009 §3, ADR 0012 §5). It is an **interface + `fetch`
 * implementation** so the auth routes can be unit-tested against a fake without network (ADR 0017), and so
 * a self-hosted GoTrue instance is a drop-in swap (ADR 0009 §3).
 *
 * Only the email+password flow is implemented for E2 (#120 — the owner's chosen initial method); the
 * `AuthCredentials` union in core-domain already discriminates on method, so OAuth/OTP are additive later.
 * The **publishable** key is used as the `apikey` header (GoTrue's public auth endpoints accept it); no
 * secret key is involved (ADR 0010 §4).
 */

import { type AppError, appError } from '@grimora/core-domain';
import { err, ok, type Result } from '@grimora/shared-types';
import type { SupabaseConfig } from '../config';

/**
 * The token set GoTrue returns on a successful grant. The **refresh token never reaches the browser as JSON**
 * — the proxy puts it in an `HttpOnly` cookie (ADR 0012 §5); only the access token + identity go to the client.
 */
export interface AuthTokens {
  /** Short-lived JWT the client holds **in memory** and sends as `Authorization: Bearer` (ADR 0012 §5). */
  readonly accessToken: string;
  /** Long-lived, rotating token the proxy stores in an `HttpOnly` cookie — never exposed to client JS. */
  readonly refreshToken: string;
  /** Access-token lifetime in **seconds** (GoTrue `expires_in`), so the client can schedule a refresh. */
  readonly expiresIn: number;
  /** The authenticated Supabase user id — becomes the {@link import('@grimora/core-domain').AuthSession} `userId`. */
  readonly userId: string;
}

/**
 * The GoTrue authentication operations the proxy needs. Every call returns a `Result` (expected failures —
 * bad credentials, an unreachable upstream — are values, never thrown, ADR 0009 §1).
 */
export interface SupabaseAuthClient {
  /**
   * Exchange email+password for a token set (GoTrue `grant_type=password`).
   * @param email     the account email
   * @param password  the account password
   * @returns         the {@link AuthTokens}, `Unauthorized` on bad credentials, or `Infrastructure` if
   *                  GoTrue is unreachable
   */
  signInWithPassword(email: string, password: string): Promise<Result<AuthTokens, AppError>>;
  /**
   * Exchange a refresh token for a fresh token set (GoTrue `grant_type=refresh_token`); the refresh token
   * rotates, so the caller must re-store the returned one.
   * @param refreshToken  the current refresh token (read from the `HttpOnly` cookie)
   * @returns             the new {@link AuthTokens}, `Unauthorized` if the token is invalid/expired, or
   *                      `Infrastructure` on an unreachable upstream
   */
  refresh(refreshToken: string): Promise<Result<AuthTokens, AppError>>;
  /**
   * Revoke the session server-side (GoTrue `/logout`). Best-effort + idempotent — an already-invalid
   * token still clears the client state, so a non-2xx upstream is not surfaced as a caller error.
   * @param accessToken  the access token identifying the session to revoke
   * @returns            ok once the revoke attempt completed
   */
  signOut(accessToken: string): Promise<Result<void, AppError>>;
}

/** The subset of GoTrue's token response this client reads. */
interface GoTrueTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly user: { readonly id: string };
}

/**
 * Build the real `fetch`-based GoTrue client for a Supabase project.
 * @param config  the Supabase URL + publishable key (from {@link import('../config').loadApiConfig})
 * @returns       a {@link SupabaseAuthClient} talking to `{url}/auth/v1`
 */
export function createSupabaseAuthClient(config: SupabaseConfig): SupabaseAuthClient {
  const base = `${config.url}/auth/v1`;
  const jsonHeaders = { apikey: config.publishableKey, 'content-type': 'application/json' };

  /** POST a token grant and normalise the response into a `Result<AuthTokens>`. */
  const tokenGrant = async (
    query: string,
    body: Record<string, string>,
  ): Promise<Result<AuthTokens, AppError>> => {
    let res: Response;
    try {
      res = await fetch(`${base}/token?${query}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(body),
      });
    } catch {
      // Network/DNS/TLS failure reaching Supabase — an infrastructure problem, not a credential one.
      return err(appError('auth.upstream_unreachable', 'Infrastructure'));
    }
    if (!res.ok) {
      // GoTrue returns 400/401 for bad credentials or an invalid/expired refresh token → Unauthorized.
      return err(appError('auth.invalid_credentials', 'Unauthorized'));
    }
    const data = (await res.json()) as GoTrueTokenResponse;
    return ok({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      userId: data.user.id,
    });
  };

  return {
    signInWithPassword: (email, password) => tokenGrant('grant_type=password', { email, password }),
    refresh: (refreshToken) =>
      tokenGrant('grant_type=refresh_token', { refresh_token: refreshToken }),
    async signOut(accessToken) {
      try {
        await fetch(`${base}/logout`, {
          method: 'POST',
          headers: { ...jsonHeaders, authorization: `Bearer ${accessToken}` },
        });
      } catch {
        // Best-effort: even if the revoke call fails, the caller still clears the cookie + client session.
      }
      return ok(undefined);
    },
  };
}
