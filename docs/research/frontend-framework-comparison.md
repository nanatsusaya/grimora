# Frontend framework comparison (input to the ADR 0002 web-framework decision)

Comparison of the major web frontend frameworks, used to decide the **web app** framework in the
[ADR 0002](../adr/0002-tech-stack-and-tooling.md) amendment (2026-07-09: **Next.js → Vite + React**) and
built on by [ADR 0012](../adr/0012-web-rendering-and-state.md) (web rendering & state). The *decision*
lives in those ADRs; this doc is the **evidence base** behind it — the same relationship as
[ADR 0020](../adr/0020-core-vs-plugin-boundary.md) ↔ [`rule-systems-comparison.md`](rule-systems-comparison.md).

> **Snapshot & sourcing.** Maturity/version claims below are **as of the 2026-07 evaluation** and should
> be re-verified from primary sources if this decision is ever revisited — framework landscapes move fast.
> Key time-sensitive facts used: **React Router 7** is Remix's framework mode with three modes incl. a
> pure **SPA mode**; **TanStack Start** reached **v1.0 (2026-03)**, client-first on Vite + Nitro;
> **SvelteKit** is the most mature non-React meta-framework. A framework is only "best" **relative to
> requirements** — so the criteria below come first.

## Why this needed re-deciding

ADR 0002 originally listed `Web = Next.js` as a bare bullet with **no recorded rationale or
alternatives-considered** (unlike bun/biome, which had been verified). When ADR 0012 fixed the frontend
as an **offline-first PWA** — the authenticated app is **client-rendered against the local store**
(SQLite-WASM/OPFS; the device is the source of truth, [ADR 0005](../adr/0005-persistence-and-sync.md)) —
Next.js's headline strength (SSR/RSC) turned out to be **unused**, which is what prompted the re-evaluation.

## Evaluation criteria (Grimora-specific — this is what makes a framework "fit")

1. **Offline-first PWA is the primary shape.** The signed-in app renders client-side against a **local
   read-model** (ADR 0012 §1/§2); **SSR of user data is neither possible nor wanted** (the server is a
   sync target, not the source of truth). So server-rendering power is largely **irrelevant** for the app
   surface; **first-class PWA/offline tooling** and a clean **static build** matter instead.
2. **Cross-platform code reuse.** Mobile is **React Native / Expo** and desktop is **Tauri** (wraps the
   web app). A **React** web app lets **view-model / hook / logic** code be shared with mobile; a non-React
   web framework breaks that alignment (the domain stays in `core-domain` regardless — ADR 0012 §4 — but
   presentation/view-model reuse is real).
3. **Solo developer + heavy AI-assist.** Ecosystem size, Stack-Overflow/issue depth, and the size of the
   **AI-training corpus** for the framework directly affect velocity for one person working with AI agents.
4. **Public/marketing pages want SSG/SEO** — but that is a **small, separable surface** (a landing page,
   docs), not the app; it does not need to drive the app framework choice.
5. **Free-tier, EU hosting.** Deploy target is **Cloudflare Pages** (ADR 0012 R1) — a static/edge host;
   a framework that needs a always-on Node server for its core value is a poorer fit.
6. **No runtime CSS-in-JS** ([ADR 0007](../adr/0007-theming.md) design tokens) — rules out frameworks
   whose idiomatic styling is runtime CSS-in-JS-first (a soft criterion; most support plain CSS).

**Framework-agnostic note:** the **local-first data layer** (SQLite-WASM/OPFS, the event log, sync — ADR
0005) is **independent of the UI framework** — it is plain TypeScript behind ports. So the framework
choice is genuinely about the **presentation shell**, not about data/offline capability, which any of the
options below could host.

## The options

| Framework | Family | Server-render story | Offline-first PWA fit | RN/Expo alignment | Ecosystem / AI-corpus | Verdict for Grimora |
| --- | --- | --- | --- | --- | --- | --- |
| **Next.js** | React meta | SSR/RSC/ISR (its core strength) | OK but SSR/RSC unused; static-export + offline has friction | ✅ React | ✅ largest | **Rejected** — pay for SSR weight we don't use |
| **Vite + React** | React (SPA) | none built-in (add static gen for marketing) | ✅ first-class (`vite-plugin-pwa`), lean static build | ✅ React | ✅ largest | **Chosen** |
| **React Router 7** | React (Remix mode) | SSR *or* SPA mode (3 modes) | ✅ good (SPA mode, data APIs) | ✅ React | ✅ large | **Folded in** — a router choice *within* Vite+React |
| **TanStack Start** | React (Vite+Nitro) | client-first, optional SSR | ✅ good, type-safe routing/data | ✅ React | 🟡 newer (v1.0 2026-03) | **Folded in** — router/data choice within the family |
| **SvelteKit** | Svelte | SSR/SSG/SPA, great adapters | ✅ excellent, tiny bundles | ❌ breaks RN alignment | 🟡 smaller, smaller AI-corpus | **Rejected** — best non-React, but breaks alignment |
| **Nuxt** | Vue | SSR/SSG mature | ✅ good | ❌ Vue ≠ React | 🟡 large (Vue), not React | **Rejected** — alignment cost |
| **SolidStart** | Solid | SSR + fine-grained reactivity | ✅ good, very fast | ❌ non-React | 🔴 smaller/less mature | **Rejected** — maturity + alignment |
| **Qwik / Qwik City** | Qwik | resumability (near-zero hydration) | benefit is SSR-content; moot for a client-rendered app | ❌ non-React | 🔴 smaller | **Rejected** — its edge is moot here |
| **Angular** | Angular | SSR (Universal), signals | ✅ capable (PWA schematics) | ❌ non-React (Ionic/NativeScript ≠ Expo) | 🟡 large but heavy | **Rejected** — heavyweight, alignment cost |
| *(Astro)* | islands/static | SSG-first | for **marketing/docs only**, not the app | n/a | 🟡 | **Complement** — small static generator for public pages |

## Per-option detail (pros / cons *for Grimora*)

- **Next.js** — *Pros:* biggest React ecosystem, very mature, excellent DX, SSR/RSC/ISR, huge AI-corpus.
  *Cons:* its **headline value (SSR/RSC) goes unused** by an offline-first client-rendered app; heavier
  runtime and build; **static-export + offline** has real friction; App-Router complexity; gravity toward
  a Node server / Vercel (deployable elsewhere, but that is the grain). **→ paying weight for power we
  don't use.**
- **Vite + React (chosen)** — *Pros:* **lean**, **first-class PWA tooling** (`vite-plugin-pwa`), very fast
  dev/HMR, clean static build for **Cloudflare Pages**, **no SSR baggage**, keeps **React/RN alignment**,
  the **largest ecosystem + AI-assist corpus**. The **router** is a separate, swappable choice (below) —
  an `apps/web` implementation detail, not a stack pillar. *Cons:* no built-in SSR (fine — the app doesn't
  want it; marketing uses a small static generator); you assemble router/data yourself (which is also
  **flexibility**).
- **React Router 7** — *Pros:* it **is** Remix's framework mode (React, Vite-based) with three modes
  including a **pure SPA mode**, plus mature data/loader APIs. *Cons:* more framework opinion than bare
  Vite. **→ not a competitor but a candidate *router* inside the Vite+React family.**
- **TanStack Start** — *Pros:* React, **client-first** on Vite + Nitro, excellent **type-safe** routing +
  data, reached **v1.0 (2026-03)**. *Cons:* youngest of the React options, smaller ecosystem than
  Next/RR. **→ the other candidate router/data layer within the family.**
- **SvelteKit** — *Pros:* the **leanest** and arguably best-DX meta-framework, tiny bundles, excellent
  PWA/adapter story, compiles the framework away. *Cons:* **breaks React/RN alignment** (mobile is Expo =
  React), shrinks the shared-logic surface **and** the AI-assist corpus; Svelte's native/mobile story is
  weaker than Expo. **→ the strongest *non-React* option; rejected only because of the alignment
  constraint.**
- **Nuxt (Vue)** — *Pros:* mature, good DX, strong SSR/SSG. *Cons:* Vue ≠ React → **alignment cost** with
  Expo; mobile story weaker than Expo. **→ rejected on alignment.**
- **SolidStart (Solid)** — *Pros:* fine-grained reactivity, very fast, small. *Cons:* **smaller/less-mature
  ecosystem**, non-React alignment, smaller AI corpus. **→ rejected.**
- **Qwik / Qwik City** — *Pros:* **resumability** (near-zero-JS hydration) is genuinely novel and great for
  **SSR-heavy content sites**. *Cons:* that benefit is **moot** for a **client-rendered offline app**;
  smaller ecosystem, non-React, novel mental model. **→ rejected: its edge doesn't apply here.**
- **Angular** — *Pros:* batteries-included, strong tooling, enterprise-grade, signals. *Cons:* **heavy and
  opinionated**, non-React alignment, larger learning/maintenance surface for a solo project; mobile via
  Ionic/NativeScript ≠ Expo. **→ rejected as over-weight for the stage.**
- **Astro** — not an app-framework competitor; a **static/islands generator** ideal for the **public
  marketing/docs surface** (ties to [ADR 0026](../adr/README.md)) alongside the Vite+React app.

## Shortlist (the 2–3 best for Grimora's frame)

1. **Vite + React** — best fit on every weighted criterion (offline-first PWA, React/RN alignment, largest
   ecosystem + AI-corpus, clean Cloudflare Pages static deploy). **Chosen.**
2. **React Router 7 / TanStack Start** — **not competitors** but the two strong candidates for the
   **router + data layer *within*** the Vite+React app; the pick between them is an `apps/web`
   implementation detail deferred to build time.
3. **SvelteKit** — the strongest **non-React** alternative, and the one to reconsider **only if** the
   React/RN cross-platform alignment ever stops being a constraint.

## Decision & reasoning (recorded in ADR 0002 amendment, built on by ADR 0012)

**Vite + React** for `apps/web`, because for an **offline-first PWA that is client-rendered against a
local store**: (a) SSR/RSC — Next.js's differentiator — is **unused**, so its weight/complexity is cost
without benefit; (b) Vite gives **first-class PWA tooling** and a lean static build that deploys to
**Cloudflare Pages**; (c) **React keeps alignment** with Expo (mobile) and Tauri (desktop wraps the web),
enabling shared view-model/hook logic; (d) React has the **largest ecosystem and AI-assist corpus**,
which matters most for a solo developer working with AI agents. The **router** (React Router 7 or TanStack
Start) is a swappable `apps/web` detail, not a stack pillar; **public/marketing pages** may use a small
static generator (e.g. Astro). Non-React options (SvelteKit/Nuxt/Solid/Qwik/Angular) were rejected chiefly
on the **cross-platform alignment cost**; SvelteKit is explicitly noted as the fallback to revisit if that
constraint changes.

## References

- [ADR 0002](../adr/0002-tech-stack-and-tooling.md) (tech stack; the 2026-07-09 Next.js → Vite + React
  amendment this doc backs), [ADR 0012](../adr/0012-web-rendering-and-state.md) (web rendering & state,
  built on this decision), [ADR 0005](../adr/0005-persistence-and-sync.md) (offline-first, local source of
  truth — why SSR of user data is moot), [ADR 0007](../adr/0007-theming.md) (design tokens, no runtime
  CSS-in-JS). Precedent for this doc's shape: [ADR 0020](../adr/0020-core-vs-plugin-boundary.md) ↔
  [`rule-systems-comparison.md`](rule-systems-comparison.md).
