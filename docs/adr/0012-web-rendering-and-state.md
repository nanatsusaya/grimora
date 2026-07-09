# ADR 0012 — Web rendering & frontend state

- **Status:** Proposed
- **Date:** 2026-07-09
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0002](0002-tech-stack-and-tooling.md) (Web = **Vite + React** [amended 2026-07-09],
  Desktop = Tauri wrapping the web app, Mobile = Expo; design-tokens JSON; no runtime CSS-in-JS), [ADR 0003](0003-overall-architecture.md)
  (§1 dependency rule, §3 module map — `ui` = presentation, `apps/*` composition roots), [ADR 0004](0004-event-sourcing-cqrs.md)
  (§5 the UI reads **read models only**, never the event store), [ADR 0005](0005-persistence-and-sync.md)
  (§1 local SQLite-WASM/OPFS store, §3 sync, §4 domain rebase), [ADR 0007](0007-theming.md) (§5 theme
  cascade; semantic-tokens-only consumption), [ADR 0008](0008-ai-provider-abstraction.md) (§2 frontend-first
  invariant; §5 AI-Act labelling in the UI), [ADR 0009](0009-cross-cutting-concerns.md) (§1 i18n message
  keys, §2 FE logger → Sentry, §3 auth/token validation at the inbound adapter), [ADR 0011](0011-api-design.md)
  (§6 API read path, §7 sync endpoints, §9 auth-in-contract / CSRF at the web layer), [ADR 0015](0015-compliance-and-data-protection.md)
  (§8 AI-Act disclosure, §9 consent-capture UI routed here), [ADR 0017](0017-testing-strategy.md) (E2E /
  Playwright — enabled once `apps/web` exists), [ADR 0024](0024-realtime-presence-sync-trust.md) (§6
  realtime liveness signal, §7 presence UI, §8 conflict-UX reserved here).
  Relates to ADR 0013 (perf/caching budgets — Planned), ADR 0016 (i18n policy — Planned), ADR 0019
  (analytics/cookie categories — Planned), ADR 0023 (presence privacy classification).

## Context

Rendering strategy drives SEO, performance, hosting and — decisively here — **offline behaviour**
(issue #14). Grimora is **offline-first**: the device is the local source of truth, holding both the
event log and the CQRS **read-model projections** in a local store (SQLite-WASM/OPFS on web, ADR 0005 §1);
the UI reads **read models only, never the event store** (ADR 0004 §5), and the API/sync is a background
replication path (ADR 0011 §7), not the UI's primary read path. This **inverts** the usual SSR assumption:
a server cannot render the authenticated app from data it does not have — the user's authoritative state
lives on their device. ADR 0002 fixed the tools (Web = **Vite + React** [amended 2026-07-09], Desktop =
Tauri **wrapping the web app**, Mobile = Expo; design-tokens JSON SSOT; no runtime CSS-in-JS); several ADRs then **routed
frontend concerns here**: consent-capture UI (ADR 0015 §9), conflict-UX (ADR 0024 §8), i18n rendering
(ADR 0009/0016), and E2E enablement (ADR 0017). A cross-model ADR review (2026-07-09) additionally
flagged **client token storage** as an unowned security question for this ADR.

**Scope:** this ADR decides the **web app** (`apps/web`) + the shared presentation layer (`packages/ui`).
Concrete **mobile** (Expo, Phase 5) and **desktop** (Tauri, Phase 7) apps are **deferred to their phase
ADRs** — but this ADR requires the frontend be structured so they are not painted into a corner (§9).
Nothing is **built** here; `apps/web` is still scaffold-only (STATUS). This is a decision record.

## Decision

### 1. Rendering per route class — public pages SSR/SSG, the app is a client-rendered offline-first PWA

Two route classes, each with a fixed strategy:

- **Public / data-less routes** (landing, login, legal/imprint, pricing) — **SSG (or SSR where dynamic)**:
  SEO, fast first paint, no user data needed. These can be statically hosted per-locale.
- **The authenticated application** (character sheets, campaigns, play) — **client-rendered against the
  local store**, delivered as an **installable, offline-capable PWA app shell**. It is **not** SSR'd:
  the authoritative data is the user's **local** projections (ADR 0005 §1), which the server does not
  hold, and SSR would fight offline-first. The app is built with **Vite + React** (ADR 0002, amended
  2026-07-09) as a **static app shell + client components** (no server-rendering of user data); a small
  static generator (e.g. Astro) may render the public routes. The **router** (TanStack Router / React
  Router 7 in SPA/data mode) is an `apps/web` implementation detail.

This split is **forced by offline-first**, not a preference. It answers issue #14's rendering-per-route
and hosting questions; the concrete hosting target (**R1**: a static app shell on Cloudflare Pages + a
separate API) is decided in the Resolved questions.

### 2. The UI's data source is the local read models; the API is bootstrap/fallback

The UI reads **exclusively** through a local **read-model query layer** over the `ReadModelStorePort`
(ADR 0004 §5 / ADR 0005 §1) — never the event store, never core internals (§11 fitness function).
The **API read path** (ADR 0011 §6) is used only as a **bootstrap** (a fresh device with no local data
yet) or an **explicit online fallback**; steady-state reads are **local-first**. Writes are **commands
through the core-domain use-cases** (frontend-first, ADR 0008 §2) that append events locally and sync in
the background (ADR 0005 §3) — the UI never writes the API directly as a CRUD store (ADR 0011 §7).

### 3. Reactivity & hydration — subscribe to local projections; realtime only nudges the sync

State flows **one way**: a local command or a synced event updates the **local projections**, which
**notify** the subscribed UI, which re-renders. Concretely:

- The UI **subscribes** to the read-model queries it renders; the local store emits change notifications
  on projection updates (rebuildable projections, ADR 0004 §5).
- The **realtime liveness signal** (ADR 0024 §6) does **not** push view state — it only signals "new
  events for stream X", which triggers the normal authenticated **pull** (ADR 0011 §7) → projections
  update → the UI updates through the same subscription. Realtime is never a second data path into the UI.
- **Hydration** is offline-first: the app shell boots, opens the local store, and renders from local
  projections immediately (no server round-trip on the critical path); a background sync reconciles.

### 4. Frontend state layers — thin, because the domain lives in `core-domain`

Frontend state is deliberately **thin** and split into three layers, so no domain logic is reimplemented
in the UI (frontend-first, ADR 0008 §2):

- **Domain/application** — **not** in the frontend; it is `core-domain` (shared TS, ADR 0003), invoked
  via use-cases. The UI holds **no** aggregate/business logic.
- **Server/sync cache** — the **local read-model projections** (ADR 0005), exposed via the reactive
  query-subscription layer (§3). This is the bulk of "app state" and it is **not** hand-managed global
  state — it is a projection of the log.
- **Ephemeral view state** — transient UI state (open modals, form drafts, selections, presence
  *display*) in a **lightweight client store**, never persisted to the event log (presence is ephemeral,
  ADR 0024 §7).

The concrete **state library** (a minimal reactive/signals store + a query-subscription adapter vs. a
heavier framework) is decided in **R3** (a minimal reactive store + a thin subscription adapter);
whatever is chosen stays behind a thin abstraction so it is swappable.

### 5. Client auth & token storage (security)

ADR 0009 §3 fixed that tokens are **validated server-side only**, and ADR 0010 §4 that **no provider/API
secret ever ships in a client bundle**. This ADR fills in **where the client keeps its own session
tokens** — the question the review flagged:

- **Access token: in memory only** (JS heap) — **never** `localStorage`/`sessionStorage`, which are
  readable by any injected script (XSS exfiltration). This **deviates from Supabase's default** (which
  persists the session in `localStorage`); the deviation is deliberate and is a §11 check.
- **Refresh token: in storage the app JS cannot read** — on **web**, a **`HttpOnly`, `Secure`,
  `SameSite` cookie** scoped to the refresh endpoint (so a refresh is cookie-based → **CSRF protection
  applies to that endpoint**, exactly the web-layer cookie case ADR 0011 §9 already anticipated); on
  **desktop/mobile**, the OS **secure store** (Tauri keychain / Expo SecureStore).
- **No long-lived secrets client-side; token refresh and any privileged provider call go through
  `apps/api`** (ADR 0010 §4). The frontend logger adapter forwards errors to **Sentry** with PII
  redaction (ADR 0009 §2).

This is **consistent with** ADR 0009/0010/0011 (it fills a gap they left open) — **no amendment needed**.

### 6. Consent-capture UI & AI disclosure (routed here)

The **consent-capture UI** (banner + a settings surface) lives in `apps/web` (ADR 0015 §9). It **writes
the ADR 0015 §2 consent record** (through the `ConsentPort` use-case, not a local flag) and **gates any
non-essential client storage/tracking behind that consent** (§25 TTDSG, ADR 0015 §9) — strictly-necessary
app storage (the local event/projection store) needs no consent, analytics/tracking does. The **specific
cookie/analytics categories** are **ADR 0019's** (not decided here). The **AI-Act Art. 50 disclosure**
(ADR 0015 §8 / ADR 0008 §5) is rendered **in the AI-chat surface** (user is told they interact with an AI;
AI output is visibly labelled).

### 7. Offline & conflict UX

- **Optimistic, local-first:** a command applies to local projections **immediately** and syncs in the
  background; the UI shows an **offline / pending-sync** indicator so the user always knows their sync
  state.
- **Conflict UX** (reserved to this ADR by ADR 0024 §8): most concurrent edits **auto-merge** on the
  ADR 0005 §4 domain rebase (intent events). Only a **genuine semantic clash** surfaces a **minimal
  resolution UI** (present both versions, let the user/GM choose) — the rare case, not the default flow.
- **Reconnect** re-pulls + re-subscribes transparently (ADR 0024 §8); presence re-establishes.

### 8. Theming & i18n consumption (reaffirm, do not re-decide)

- **Theming:** the web app consumes the **generated CSS custom properties** from the design-tokens SSOT
  (ADR 0002 / ADR 0007) and **only semantic tokens, never primitives** (ADR 0007); the ADR 0007 §5
  cascade is applied via CSS `@layer` / custom-property scoping. **No runtime CSS-in-JS** (ADR 0002).
- **i18n:** the UI resolves **i18n message keys** at the presentation layer (the domain/events carry
  keys, not translated strings — ADR 0009 §1, ADR 0004 §10, ADR 0021 R3); this ADR sets up the
  message-resolution integration in `apps/web`, while the **language set, fallback and translation
  policy are ADR 0016's**. Public routes may be statically rendered per-locale (§1).

### 9. `apps/web` structure, `packages/ui`, cross-platform posture & hosting

- `apps/web` is a **composition root** (ADR 0003 §3): it wires adapters (local store, sync, auth, logger,
  realtime) to the core-domain ports and mounts the UI. Presentation components live in **`packages/ui`**
  (ADR 0003 module map).
- **Cross-platform posture (R2):** share the **core-domain + design tokens + view-model/hook logic**
  across platforms; keep **platform-specific rendering** (web DOM vs. React Native) at the edge. **Desktop
  = Tauri wrapping this web app** (ADR 0002), so it inherits these decisions. **Mobile (Expo/RN) is
  deferred to its Phase-5 ADR** — this ADR only requires the shared layer not assume the DOM so mobile
  stays reachable. Per **R2**, a single cross-platform component framework (e.g. RN-Web / Tamagui) is
  **not** adopted now; per-platform components + shared logic/tokens, revisited at Phase 5.
- **Hosting (R1):** a static app shell + PWA assets fit **static hosting**; the target is **Cloudflare
  Pages** (strong free tier + edge, ADR 0002 cost goal); the API (`apps/api`) and sync are separate
  (ADR 0011).

### 10. E2E enablement (ADR 0017)

Once `apps/web` exists, **Playwright E2E** — deliberately scoped out by ADR 0017/ADR 0022 while there was
no web app — becomes the **top-of-pyramid** layer for a small set of **golden user journeys** (login →
create character → make a check → see it sync). ADR 0017 owns the *strategy*; this ADR records that the
web app **unblocks** it and that critical journeys get E2E coverage as the app is built.

### 11. Enforcement (fitness functions)

- **UI reads only via the read-model/query layer** — `apps/web` / `packages/ui` must **not** import the
  event store, `SyncPort` internals, or core internals directly (extends the ADR 0003 §1 dependency rule
  to the presentation layer; harness check).
- **No domain logic in the frontend** — writes go through core-domain use-cases (frontend-first,
  ADR 0008 §2); a UI module implementing aggregate rules is a boundary violation (review check).
- **No session token in `localStorage`/`sessionStorage`** (§5) — a lint/scan against persisting the
  access/refresh token in web storage.
- **No runtime CSS-in-JS; semantic tokens only** (ADR 0002/0007) — checkable against the styling layer.

### 12. No amendment to any accepted ADR

This ADR **fills gaps** the earlier ADRs left open (rendering posture, local-data reactivity, token
storage, consent UI) and **reuses** their decisions unchanged; it requires **no owner-authorized
amendment** to any accepted ADR (unlike ADR 0024 §10). In particular the token-storage cookie case is the
one ADR 0011 §9 already anticipated, and the theming/i18n sections only *consume* ADR 0007/0009/0016.

## Consequences

**Positive:** the rendering decision is coherent with offline-first — the app boots and works from local
data with **no server on the critical path**, while public pages stay SEO-friendly; the UI stays **thin**
(the domain is in `core-domain`, reused across platforms), so the frontend-first invariant holds by
construction; **token storage is made secure and explicit** (in-memory access + non-JS-readable refresh),
closing the review's flagged gap; consent UI, conflict UX, theming and i18n consumption all have a defined
home; E2E finally becomes possible; and **no accepted ADR is disturbed**.

**Negative / costs:** a client-rendered offline-first app forgoes SSR benefits for the authenticated
surface (first-load JS weight, no server-side data render) — mitigated by the PWA shell + local data being
*faster* than a round-trip once hydrated (budgets are ADR 0013's); a reactive local-store query layer is
real infrastructure to build (subscriptions, invalidation on projection rebuild); the in-memory access
token means a full page reload must silently refresh from the cookie/secure store (a deliberate
security/UX trade); and keeping the shared layer DOM-agnostic for a not-yet-built mobile app adds mild
discipline now for a Phase-5 payoff.

## Alternatives considered

- **SSR/ISR the authenticated app** (server-render character sheets) — rejected: the authoritative data is
  on the device (offline-first, ADR 0005); the server cannot render it, and SSR would undercut offline
  behaviour. SSR/SSG is kept for public, data-less routes only.
- **UI reads the API/event store directly** — rejected: violates ADR 0004 §5 (UI reads read models) and
  the offline-first local-first read path; the API is bootstrap/fallback only.
- **A heavyweight global client state store holding domain state** — rejected: duplicates `core-domain`
  logic in the frontend, breaking the frontend-first invariant (ADR 0008 §2); state stays a projection of
  the log plus thin ephemeral view state.
- **Persist tokens in `localStorage` (Supabase default)** — rejected: XSS-exfiltratable; access token in
  memory + refresh in an `HttpOnly` cookie / secure store instead (§5).
- **Runtime CSS-in-JS** — rejected by ADR 0002 (perf, no SSR-flash); generated CSS custom properties from
  the token SSOT instead.
- **Adopt a single cross-platform UI framework now** (RN-Web/Tamagui) — deferred, not rejected: premature
  before mobile starts; share core-domain + tokens now, decide the component strategy at Phase 5 (O2).

## Resolved questions (owner decisions, 2026-07-09)

- **R1 — Rendering posture + hosting (§1/§9).** Confirmed: the authenticated app is a **client-rendered
  offline-first PWA shell** (no SSR of user data), SSR/SSG only for public/data-less routes; **static
  hosting on Cloudflare Pages** (strong free tier + edge, ADR 0002 cost goal), the API hosted separately.
  The posture is forced by offline-first; the hosting target is revisitable via the `apps/web` structure.
- **R2 — Cross-platform UI sharing (§9).** Decided **(b)**: share **core-domain + design tokens +
  view-model/hook logic** across platforms and keep **per-platform** components; a single cross-platform
  component framework (RN-Web / Tamagui) is **not** adopted now — that choice is revisited when mobile
  actually starts (Phase 5). Avoids over-committing before mobile exists; the token/domain sharing already
  prevents divergence.
- **R3 — Frontend state library (§4).** Decided **(a)**: a **minimal reactive/signals store** (for
  ephemeral view state) + a **thin query-subscription adapter** over the local read-model store — no
  heavy data-layer or global-state framework, because the domain lives in `core-domain`. Kept behind a
  thin abstraction so the concrete library stays swappable.

> **Note (2026-07-09):** the web *framework* was re-evaluated at the owner's request; **the decision is
> Vite + React** (replacing Next.js), authorized as an **amendment to ADR 0002** carried in this same PR.
> R1–R3 were framework-independent and are unaffected; §1/§9 now reflect Vite + React.

## References

- [ADR 0002](0002-tech-stack-and-tooling.md) (Vite + React / Tauri / Expo; tokens JSON; no runtime CSS-in-JS),
  [ADR 0003](0003-overall-architecture.md) (§1 dependency rule, §3 module map / composition roots),
  [ADR 0004](0004-event-sourcing-cqrs.md) (§5 UI reads read models), [ADR 0005](0005-persistence-and-sync.md)
  (§1 local store, §3 sync, §4 rebase), [ADR 0007](0007-theming.md) (§5 cascade; semantic tokens),
  [ADR 0008](0008-ai-provider-abstraction.md) (§2 frontend-first, §5 AI labelling), [ADR 0009](0009-cross-cutting-concerns.md)
  (§1 i18n keys, §2 FE logging, §3 auth), [ADR 0011](0011-api-design.md) (§6 read path, §7 sync, §9
  auth/CSRF), [ADR 0015](0015-compliance-and-data-protection.md) (§8 AI disclosure, §9 consent UI),
  [ADR 0017](0017-testing-strategy.md) (E2E/Playwright), [ADR 0024](0024-realtime-presence-sync-trust.md)
  (§6 realtime signal, §7 presence, §8 conflict-UX), ADR 0013 (perf budgets — Planned), ADR 0016 (i18n —
  Planned), ADR 0019 (analytics/cookies — Planned), ADR 0023 (presence privacy). Issue #14.
