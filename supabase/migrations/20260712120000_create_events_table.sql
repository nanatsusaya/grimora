-- Canonical, append-only domain event log in Supabase Postgres (ADR 0004/0005 §2) — the authoritative
-- record the cloud holds; read models project from it (ADR 0005 §6). This is the cloud counterpart to the
-- local SQLite/OPFS event store (packages/event-store); the same event envelope is stored, plus one
-- cloud-only column, `owner_id`, for tenancy/RLS (ADR 0005 §7, ADR 0024 §2).
--
-- Enforcement model (ADR 0009 / ADR 0024 §2): the `apps/api` sync endpoints are the primary gate — they
-- verify the caller's Supabase access token, derive the account id from it, and set `owner_id` to that
-- account on insert (never trusting a client-claimed owner). The RLS policies below are **defense in
-- depth** (ADR 0009 "RLS is defense-in-depth, never the sole gate"): they bind any *authenticated-role*
-- access to its own rows, so a future direct/PostgREST path cannot cross tenants either. `apps/api`
-- connects with a privileged role that bypasses RLS by design — its own JWT check is the real boundary.

create table if not exists public.events (
  -- Globally-unique event id (client-generated UUIDv7) — the dedup key on insert-only replication
  -- (ADR 0005 §3): a re-pushed event with the same id is an idempotent no-op, never a duplicate.
  id uuid primary key,
  -- The aggregate stream this event belongs to (character/campaign/…).
  aggregate_id uuid not null,
  aggregate_type text not null,
  -- Intent-named, past-tense event type (ADR 0004 §10), e.g. `character.attributeSet`.
  type text not null,
  -- Per-aggregate, 1-based causal version. Unique per stream (constraint below) — this bounds the
  -- concurrent-roll collision to a single rebased pair (ADR 0024 §3) and drives optimistic concurrency.
  version integer not null,
  -- Payload schema version, for upcasting old payloads forward on read (ADR 0004 §6).
  schema_version integer not null default 1,
  occurred_at timestamptz not null,
  -- The event payload + envelope metadata (actorId pseudonym, ADR 0023 §3) as JSON — the store stays
  -- rule-agnostic (ADR 0004 §4), so concrete shapes live in the JSON, not columns.
  -- NOTE (audit follow-up 2026-07-12): these are stored **unencrypted** today. The ADR 0023 per-subject
  -- field encryption + crypto-shredding (CryptoPort) are **NOT yet implemented** (deferred, #74) — so
  -- personal data is NOT cryptographically protected or erasable here yet. Until then, use only dev /
  -- non-personal data in this table (grimora-dev). Do not read the erasure note below as "already enforced".
  payload jsonb not null,
  metadata jsonb,
  -- The owning account (RLS/tenancy anchor). Set to the authenticated account by `apps/api` on push
  -- (ADR 0024 §2 actor-binding); it is NOT part of the immutable event envelope but a storage annotation,
  -- so re-attributing a device's pre-login streams to the account (ADR 0012 §13) needs no event rewrite.
  owner_id uuid not null,
  -- Store-assigned canonical global order (ADR 0004 §2). The pull cursor: clients page by `position`.
  -- IDENTITY (not the client `version`) so the cloud owns the global sequence across all streams.
  position bigint generated always as identity,
  -- Per-aggregate version uniqueness — the real durable enforcement the in-memory fake mirrors (ADR 0024
  -- §3; the C11 collision bound). A second event claiming an existing (aggregate, version) is rejected.
  constraint events_aggregate_version_unique unique (aggregate_id, version)
);

-- Pull reads scan by global `position` (the cursor); per-stream rehydration reads by (aggregate, version).
create index if not exists events_position_idx on public.events (position);
create index if not exists events_aggregate_version_idx on public.events (aggregate_id, version);
-- RLS predicate + owner-scoped pulls filter by owner.
create index if not exists events_owner_idx on public.events (owner_id);

alter table public.events enable row level security;

-- Owner-scoped access only (ADR 0005 §7). Campaign-shared streams (gm/player/spectator visibility) are a
-- later policy, once a campaign-membership model exists (#106 deferred resolution / #107) — owner-only is
-- the correct minimal scope for the current single-owner state (ADR 0012 §13). `(select auth.uid())` is
-- Supabase's recommended form (the subquery caches the call per statement).
--
-- `drop policy if exists` before each `create policy` keeps the whole migration **idempotent / re-runnable**:
-- it may be applied both by the dev runner (scripts/db-migrate.ts) and by the Supabase GitHub integration
-- on merge without a "policy already exists" error.
drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select
  using (owner_id = (select auth.uid()));

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert
  with check (owner_id = (select auth.uid()));

-- Append-only (ADR 0004): no UPDATE or DELETE policy is defined, so RLS denies both to every
-- authenticated role. Erasure is *intended* to be crypto-shredding of the per-subject key (ADR 0023), not
-- row deletion — but that mechanism is **not yet built** (see the payload note above / #74); today there is
-- no erasure path for stored payloads, which is why only dev/non-personal data belongs here for now.
