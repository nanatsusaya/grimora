/**
 * Runtime configuration for `apps/api`, loaded **only here at the composition-root edge** (ADR 0010 §4:
 * secrets/config are read at the composition root, never deeper). The values come from the environment
 * (a git-ignored `apps/api/.env` locally; GitHub-Environment secrets in CI/prod, ADR 0014 §6). This module
 * does the reading + fail-fast validation so the rest of the app receives a typed, already-validated shape
 * and never touches `process.env` itself.
 *
 * Only **non-secret** and **low-sensitivity** values live here for the E2 auth proxy: the Supabase project
 * URL and the browser-safe **publishable** key (ADR 0010 §4 — the `secret` key never enters the client
 * path and is not needed by the password grant, which uses the publishable key as `apikey`).
 */

/** The Supabase connection + auth settings the API needs. */
export interface SupabaseConfig {
  /** The project base URL, e.g. `https://<ref>.supabase.co` (not a secret — present in every client). */
  readonly url: string;
  /** The **publishable** API key (`sb_publishable_…`) used as GoTrue's `apikey` header (browser-safe). */
  readonly publishableKey: string;
}

/** How the API sets its auth cookies — split out so dev-over-http can relax `Secure` (ADR 0012 §5). */
export interface CookieConfig {
  /**
   * Whether the refresh cookie carries the `Secure` flag. Defaults to `true` (ADR 0012 §5); a local dev
   * run over plain `http://localhost` can set `COOKIE_SECURE=false` so the browser still stores it.
   */
  readonly secure: boolean;
}

/** The full API config surface (grows as more adapters are wired). */
export interface ApiConfig {
  readonly supabase: SupabaseConfig;
  readonly cookie: CookieConfig;
}

/**
 * Load + validate the API config from an environment bag, failing fast on a missing required value so a
 * misconfigured deployment cannot start half-wired (ADR 0010 §4 / ADR 0014 §6). Called once at the
 * composition-root entry (`server.ts`); tests inject a config directly and never touch this.
 * @param env  the environment bag to read (`process.env` in production)
 * @returns    a fully-validated {@link ApiConfig}
 * @throws     Error if a required variable (`PROJECT_URL`, `PUBLISHABLE_KEY`) is missing/empty
 */
export function loadApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const url = required(env, 'PROJECT_URL');
  const publishableKey = required(env, 'PUBLISHABLE_KEY');
  // Default-secure; only an explicit `COOKIE_SECURE=false` (local http dev) relaxes it.
  const secure = env.COOKIE_SECURE !== 'false';
  return { supabase: { url, publishableKey }, cookie: { secure } };
}

/**
 * Read a required environment variable, throwing a clear error if it is absent or blank — so a
 * missing secret is a loud startup failure, never a silent `undefined` reaching an adapter.
 * @param env   the environment bag
 * @param name  the variable name to read
 * @returns     the non-empty value
 * @throws      Error naming the missing variable
 */
function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `apps/api config: missing required environment variable ${name} (see apps/api/.env.example)`,
    );
  }
  return value;
}
