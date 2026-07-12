/**
 * Supabase access-token verification for `apps/api` (#107, ADR 0024 §2). The sync endpoints must
 * **hard-enforce** that the pusher is who the JWT says (actor-binding) before using that identity as the
 * event's `owner_id`. Supabase signs access tokens with **asymmetric ES256** keys, so verification is a
 * signature check against the project's public **JWKS** — no shared secret is needed (only `PROJECT_URL`),
 * which is why the `secret` key never has to touch this path (ADR 0010 §4).
 *
 * It is an interface + `jose` implementation so the routes can be unit-tested against a fake verifier
 * without network (ADR 0017).
 */

import { type AppError, appError } from '@grimora/core-domain';
import { err, ok, type Result } from '@grimora/shared-types';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { SupabaseConfig } from '../config';

/** The verified caller identity extracted from a valid access token. */
export interface VerifiedActor {
  /** the authenticated account id (the JWT `sub`) — becomes the cloud `owner_id` (ADR 0024 §2) */
  readonly accountId: string;
}

/** Verifies a bearer access token and yields the caller's account id, or an `Unauthorized` error. */
export interface TokenVerifier {
  /**
   * Verify a Supabase access token's signature + claims.
   * @param accessToken  the raw JWT from the `Authorization: Bearer` header
   * @returns            the {@link VerifiedActor}, or an `Unauthorized` `AppError` for any invalid token
   */
  verify(accessToken: string): Promise<Result<VerifiedActor, AppError>>;
}

/**
 * Build the real JWKS-based verifier for a Supabase project. `createRemoteJWKSet` fetches + caches the
 * project's public keys (and refetches on key rotation), so verification is offline-fast after the first
 * call and needs no secret.
 * @param config  the Supabase config (its `url` fixes the issuer + JWKS endpoint)
 * @returns       a {@link TokenVerifier} that checks ES256 signature, `iss` and `aud`
 */
export function createJwksTokenVerifier(config: SupabaseConfig): TokenVerifier {
  const issuer = `${config.url}/auth/v1`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return {
    async verify(accessToken) {
      try {
        const { payload } = await jwtVerify(accessToken, jwks, {
          issuer,
          audience: 'authenticated',
        });
        if (!payload.sub) return err(appError('auth.invalid_token', 'Unauthorized'));
        return ok({ accountId: payload.sub });
      } catch {
        // Bad signature / expired / wrong issuer or audience → uniformly Unauthorized (never leak why).
        return err(appError('auth.invalid_token', 'Unauthorized'));
      }
    },
  };
}
