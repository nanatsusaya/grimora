# Grimora — Supabase project setup (runbook)

Reproducible procedure for provisioning a Grimora Supabase project, with the **reasoning** for each
choice so it can be repeated (a second project, the future production project, a self-host reviewer)
without re-deriving the decisions. This is the `docs/ops/` provisioning counterpart to the rotation /
restore runbooks named in [ADR 0014](../adr/0014-devops-and-delivery.md) §6/§7; it operationalizes
ADR 0014 §4 (environment separation), §5 (config-in-repo), §6 (secret handling) and the ADR 0015
EU-residency / DPA gates.

**Posture (why this is smaller than a typical cloud setup):** Grimora is **offline-first** — the device
is the source of truth and Supabase is a sync target / backup ([`hosting.md`](../hosting.md), ADR 0005).
The client never queries the database directly: it talks to `apps/api`, and to Supabase only for the
**Auth JWT** (ADR 0009/0012 §11). That shapes several of the security choices below (Data API off,
new secret keys server-side only).

## Current state (what is provisioned)

| Item | Value |
| --- | --- |
| Non-prod dev project | **`grimora-dev`** — provisioned 2026-07-12 |
| Organization | `Grimora` (Free plan) |
| Region | **Central EU (Frankfurt)** `eu-central-1` |
| Project ref / ID | `maupuczenomsvzoxvpst` *(not a secret — present in every client URL)* |
| Project URL | `https://maupuczenomsvzoxvpst.supabase.co` *(not a secret)* |
| Direct connection | `postgresql://postgres:[DB-PASSWORD]@db.maupuczenomsvzoxvpst.supabase.co:5432/postgres` |
| Postgres type | Standard **Postgres** (not OrioleDB) |
| API keys | new **publishable / secret** system (not legacy `anon` / `service_role`) |

**Production is deliberately not provisioned yet.** The Free tier allows **2 active projects per
organization**; a separate **production** project (its own secrets, EU region) is stood up only at
go-live, when the ADR 0015 §6 DPA/backup gates also apply (see [§7](#7-go-live-gates-not-now)). One
non-prod dev project is enough to build and exercise the sync (#107) and auth (#120) slices.

## 1. Account & organization

1. Sign up at [supabase.com](https://supabase.com) (GitHub login or e-mail).
2. **Enable MFA** on the account — this account can reach the production data store later.
3. Create an **organization** (`Grimora`), **Free** plan. No payment method is added at this stage, so
   no paid feature can bill silently (it is simply unavailable until an explicit upgrade).

## 2. Create the project — the settings that matter

Two settings under *Advanced configuration* are **irreversible after creation** — get them right the
first time.

| Setting | Choice | Reversible? | Why |
| --- | --- | --- | --- |
| **Region** | Central EU (Frankfurt) `eu-central-1` | **No** (fixed at creation) | EU data residency (ADR 0015); lowest latency from Germany. |
| **Postgres type** | **Postgres (DEFAULT)** | **No** (fixed at creation) | OrioleDB is ALPHA / "not recommended for production"; the append-only event log is the crown jewel (ADR 0004/0005) and belongs on the proven engine. |
| **Database password** | strong, generated | password rotation possible | Store in the password manager. If you build the Postgres connection string by hand, the password must be **percent-encoded** (Supabase warns on this). |
| **Enable Data API** | **Off** | Yes (Project Settings → API) | The auto-generated PostgREST REST API over `public`. We do **not** use it: the client goes through `apps/api`, which reaches Postgres over the **direct connection** (our event store needs custom SQL — `UNIQUE(aggregate_id, version)`, optimistic concurrency — that PostgREST cannot express). Off = smallest attack surface (ADR 0010). |
| **Automatically expose new tables** | **Off** | Yes | Supabase's own recommendation; keeps table exposure under manual control. |
| **Enable automatic RLS** | **On** | Yes | Defense-in-depth backstop — an event trigger enables Row Level Security on every new `public` table, so no table is ever accidentally open. RLS is never our sole gate (ADR 0009), but this costs nothing and complements the RLS our migrations declare (ADR 0005 §6). |

**Note on "Data API off":** Supabase warns that `supabase-js` and similar client libraries can then no
longer *query or mutate data*. That is by design — we never query the DB from the client. **Auth
(GoTrue), Storage and Realtime are separate services** and are **unaffected** by this switch, so the
later login flow (#120) works normally.

## 3. GitHub integration & branching (cost caution)

The project is linked to the GitHub repo `nanatsusaya/grimora`. What this gives us — and the cost line
to respect:

- **Migration auto-deploy (free, wanted):** migrations committed under **`supabase/migrations`** are
  applied automatically on merge to the production branch. This is the "agent-first" flow and matches
  our decision to keep **schema/RLS as versioned migration files in-repo** (ADR 0005 §6 / ADR 0014 §5).
  It does **nothing** until a `supabase/` directory with migrations exists (created when #107 starts).
  The one behavioural consequence: after that, a merged migration PR changes the `grimora-dev` schema
  automatically — which is exactly what we want for a dev project.
- **Preview branches are a paid Pro feature — do NOT assume they are free.** Per-PR preview branches are
  **not available on Free** and are **billed by runtime** (~$0.0134 / hour per branch on the default
  Micro compute; a persistent 24/7 branch ≈ $9.70 / month; compute credits do **not** offset branch
  compute). Because the org is Free with no payment method, this cannot bill silently — but do not
  enable paid branching without an explicit owner decision. Sources:
  [Manage Branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching),
  [Pricing](https://supabase.com/pricing).

The integration is reversible (Supabase dashboard) and grants Supabase deploy-access to the repo — a
deliberate, owner-made, revocable coupling.

## 4. API keys — use the new publishable / secret system (not legacy)

Supabase now offers **publishable / secret** keys alongside the legacy JWT-based `anon` / `service_role`
keys. For a fresh project, **use the new keys** — they are individually revocable (one per backend
component recommended), which fits our rotate-by-handle secret ops (ADR 0010 §4 / ADR 0014 §6). The
legacy keys are not yet formally deprecated but there is no reason to build on them. Source:
[API keys](https://supabase.com/docs/guides/api/api-keys).

| Key | Successor to | Sensitivity | Where it may live |
| --- | --- | --- | --- |
| **Publishable** `sb_publishable_…` | `anon` | **Low** — browser-safe, may appear in client source (only works with RLS) | frontend / Supabase Auth client (#120) |
| **Secret** `sb_secret_…` | `service_role` | **High** — bypasses RLS, full data access | **composition root only** (`apps/api`); never browser, repo, logs, or chat |

**Minimize secret sprawl — what to hold now:**

- **Publishable key:** copy into the password manager now (low sensitivity; used later by the login flow).
- **Secret key:** **do not create one yet.** #107's sync adapter reaches Postgres over the **direct
  connection string**, not an API key, so no secret key is needed until a server-side Supabase *service*
  call is (auth-admin / storage). Create one **per component, when needed**, then store it in the
  password manager only.
- **Direct connection string / DB password:** the credential that actually matters for #107 — store it
  securely.

## 5. Credential & secret handling (the invariant)

- **Source of truth = the owner's password manager**: DB password, direct connection string, publishable
  key, (later) secret key, and the Supabase CLI access token (`supabase login`).
- **Never** commit a secret, log it, or paste it into an agent chat. The **secret key never leaves
  `apps/api`** (ADR 0010 §4 — secrets only at the composition root).
- **In-repo pattern:** a **git-ignored `.env`** holds the real values locally; a **committed
  `.env.example`** carries placeholders only. Config is wired at the composition root, referenced by
  handle so rotation is "update the value + redeploy", no code change (ADR 0014 §6).
- **Non-secret** project identifiers (Project URL, ref/ID, region, the connection-string *template* with
  a `[DB-PASSWORD]` placeholder) may be recorded here in the repo — they are exposed to every client
  anyway.

## 6. CLI setup (run when #107 starts)

```
supabase login                                   # interactive; yields an access token — treat as a secret
supabase init                                    # creates the supabase/ directory + config.toml
supabase link --project-ref maupuczenomsvzoxvpst # binds the local CLI to grimora-dev
```

`supabase login` is interactive, so the owner runs it (in-session via `! supabase login`, or locally).
`supabase init` creates the `supabase/migrations` directory the GitHub integration (§3) watches.

## 7. Environments & data isolation (forward-looking)

Per ADR 0014 §4, three logical environments — **Local** (`docker compose up -d`, no cloud),
**Preview** (per-PR, shared non-prod), **Production** (a *separate* Supabase project, EU region, its
own secrets). `grimora-dev` is the **non-prod** project. **Hard rule:** no non-prod environment ever
points at production data; production is a distinct project stood up at go-live.

## 8. Go-live gates (not now)

Before real users are onboarded (tracked against ADR 0015 §6 / ADR 0014 §7):

- **Signed DPA (Art. 28)** with Supabase, plus a **TIA** for any external transfer — a release gate
  (ADR 0015 §6). Not needed while only fake data is used offline.
- **Managed backups verified enabled + one test restore performed**; the **key-store-separate-backup**
  invariant in place (ADR 0014 §7 / ADR 0023 §5).
- **Pro tier** when real users justify daily backups / PITR (ADR 0014 §7).
- A separate **production** project provisioned with its own least-privilege secrets (§7).

## References

- [ADR 0002](../adr/0002-tech-stack-and-tooling.md) (Supabase EU in the stack),
  [ADR 0005](../adr/0005-persistence-and-sync.md) (§2 canonical events table, §6 migrations in-repo),
  [ADR 0009](../adr/0009-cross-cutting-concerns.md) (Auth vs. RLS),
  [ADR 0010](../adr/0010-security-and-privacy-by-design.md) (§4 secrets at the composition root),
  [ADR 0012](../adr/0012-web-rendering-and-state.md) (§11 client reads read-models, not the DB),
  [ADR 0014](../adr/0014-devops-and-delivery.md) (§4 environments, §5 config-in-repo, §6 secrets, §7 backup/DR),
  [ADR 0015](../adr/0015-compliance-and-data-protection.md) (§6 DPA/TIA go-live gate, EU residency),
  [ADR 0023](../adr/0023-event-payload-privacy.md) (§5 key-store-separate backup).
- [`hosting.md`](../hosting.md), [`access-and-accounts.md`](../access-and-accounts.md).
- Related work: **#107** (sync adapter — the first consumer of this project), **#120** (auth binding).
