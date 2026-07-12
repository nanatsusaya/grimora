/**
 * `AuthPanel` — the login / signed-in surface in the app shell (#120 E3b). It is **additive** to the
 * offline-first app: the character flow works under the ADR 0012 §13 device identity whether or not the
 * user is signed in; this panel just lets them establish an `AuthPort` session (email+password, the E2/E3
 * method) and shows who they are. Reads/writes only via the injected {@link AuthPort} — no domain logic,
 * no token handling here (the adapter keeps the access token in memory, ADR 0012 §5).
 */

import type { AuthPort, AuthSession } from '@grimora/core-domain';
import { Button, Field } from '@grimora/ui';
import { type FormEvent, useEffect, useState } from 'react';

/** The non-sensitive outcome of a manual cloud sync (from the view's `syncNow`) — counts only, for display. */
interface SyncOutcome {
  readonly ok: boolean;
  readonly pushed: number;
  readonly pulled: number;
}

/**
 * Subscribe a component to the current auth session. The `AuthPort` is async by contract, so this bridges
 * it to React state: it seeds from `getSession()` and updates on every `onSessionChange` (sign-in / sign-out
 * / boot `restore()`), cleaning up the subscription on unmount.
 * @param auth  the auth port to observe
 * @returns     the current session, or `undefined` when unauthenticated
 */
function useAuthSession(auth: AuthPort): AuthSession | undefined {
  const [session, setSession] = useState<AuthSession | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void auth.getSession().then((current) => {
      if (active) setSession(current);
    });
    const unsubscribe = auth.onSessionChange(setSession);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);
  return session;
}

/**
 * The auth panel: a signed-in banner (with sign-out + a manual cloud-sync trigger) when authenticated,
 * otherwise an email+password login form.
 * @param props            the component props
 * @param props.auth       the client-side authentication port (from the composition root)
 * @param props.onSyncNow  optional manual cloud-sync trigger (the view's `syncNow`: push + pull + reproject,
 *                         #107 slice 3); when provided, the signed-in banner shows a "Sync now" button.
 *                         Optional so the panel renders without it (tests, or before sync is wired)
 * @returns                the auth surface for the current session state
 */
export function AuthPanel({
  auth,
  onSyncNow,
}: {
  readonly auth: AuthPort;
  readonly onSyncNow?: () => Promise<SyncOutcome>;
}) {
  const session = useAuthSession(auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);

  const panelStyle = {
    marginBottom: 'var(--gr-space-lg)',
    paddingBottom: 'var(--gr-space-md)',
    borderBottom: '1px solid var(--gr-color-border)',
  };

  if (session) {
    /** Trigger a cloud sync (push + pull + reproject) and reflect the non-sensitive outcome in the banner. */
    const onSync = () => {
      if (!onSyncNow) return;
      setSyncing(true);
      setSyncStatus(undefined);
      void onSyncNow().then((outcome) => {
        setSyncing(false);
        if (!outcome.ok) {
          setSyncStatus('Sync failed — will retry later.');
          return;
        }
        const { pushed, pulled } = outcome;
        setSyncStatus(
          pushed === 0 && pulled === 0
            ? 'Up to date.'
            : `Synced: ${pushed} sent, ${pulled} received.`,
        );
      });
    };

    return (
      <section data-testid="auth-signed-in" style={panelStyle}>
        <span style={{ fontFamily: 'var(--gr-font-sans)' }}>
          Signed in as <code>{session.userId}</code>
        </span>{' '}
        {onSyncNow && (
          <Button disabled={syncing} onClick={onSync}>
            Sync now
          </Button>
        )}{' '}
        <Button onClick={() => void auth.signOut()}>Sign out</Button>
        {syncStatus && (
          <p
            data-testid="sync-status"
            style={{ fontFamily: 'var(--gr-font-sans)', marginTop: 'var(--gr-space-sm)' }}
          >
            {syncStatus}
          </p>
        )}
      </section>
    );
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    void auth.signIn({ method: 'password', email: email.trim(), password }).then((result) => {
      setBusy(false);
      // A single, non-enumerating message — never reveal whether the email or the password was wrong.
      if (!result.ok) setError('Sign-in failed — check your email and password.');
    });
  };

  return (
    <section data-testid="auth-login" style={panelStyle}>
      <form onSubmit={onSubmit}>
        <Field label="Email">
          <input
            aria-label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{ fontFamily: 'var(--gr-font-sans)' }}
          />
        </Field>
        <Field label="Password">
          <input
            aria-label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{ fontFamily: 'var(--gr-font-sans)' }}
          />
        </Field>
        {error && (
          <p data-testid="auth-error" style={{ color: 'var(--gr-color-text)' }}>
            ⚠ {error}
          </p>
        )}
        <Button type="submit" disabled={busy} onClick={() => undefined}>
          Sign in
        </Button>
      </form>
    </section>
  );
}
