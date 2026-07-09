/**
 * Architecture conformance harness — import-boundary rules (issue #9).
 *
 * Encodes the **dependency rule** from ADR 0003 §2 and the module map (§3), plus the
 * security fitness functions from ADR 0003 §6 / "Enforcement" and ADR 0010 §7. Rules are
 * intentionally **forward-looking**: most target packages (core-domain, adapters, plugins,
 * apps) do not exist yet, so they match nothing today and start biting the moment those
 * modules are added — which is the point ("adding a new module is covered by the rules").
 *
 * Path patterns use the loose `(?:^|/)` prefix (not `^`) so the exact same ruleset governs
 * both the real tree (`packages/…`) and the harness's own self-test fixtures
 * (`scripts/arch/__fixtures__/…/packages/…`), without duplicating rules. See
 * `scripts/arch/boundaries.test.ts`, which proves a deliberate violation is caught.
 *
 * **Scope of these rules is *import boundaries* only.** The ADRs also mandate *call-graph* /
 * *content* fitness functions the dependency-cruiser cannot express — default-deny `PolicyPort`
 * (ADR 0010 §7.4), the external-AI consent gate (ADR 0015 §10), per-field privacy classification
 * (ADR 0023 §8), UI-reads-read-models-only (ADR 0012 §11) and a `@grimora/core-domain/testing`
 * production-import guard (ADR 0017 R1). Those are **not yet enforced here** — tracked in **#76** —
 * so "green `arch`" means "import boundaries hold", not "every ADR invariant is machine-checked".
 * This is stated explicitly so no reader mistakes the harness's current reach for the full set.
 *
 * Run via `bun run arch`. Referenced ADR sections are cited per rule.
 */

// Adapter packages (ADR 0003 §3 module map). This is an **allowlist**: when a new adapter package
// is added (e.g. a Supabase sync adapter), it MUST be appended here, or `core-no-adapters` /
// `adapters-no-cross-adapter` will not govern it. Kept explicit rather than a wildcard so a new
// top-level `packages/*` cannot silently be treated as an adapter (or silently escape adapter rules).
const ADAPTER_PKGS = 'event-store|cqrs-read|offline-sync|ai-agent';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'ADR 0003 §2.7 — package/module graph must be a DAG (no cycles between modules).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-no-application',
      severity: 'error',
      comment:
        'ADR 0003 §1 — the Domain layer depends on shared-types only; it must not import ' +
        'the Application layer (dependencies flow Application → Domain, never back).',
      from: { path: '(?:^|/)packages/core-domain/src/domain/' },
      to: { path: '(?:^|/)packages/core-domain/src/application/' },
    },
    {
      name: 'domain-no-node-builtins',
      severity: 'error',
      comment:
        'ADR 0003 §6.1 — no ambient authority: Domain obtains all I/O, time, randomness and ' +
        'network only through injected ports, never Node core/builtin modules.',
      from: { path: '(?:^|/)packages/core-domain/src/domain/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'core-no-adapters',
      severity: 'error',
      comment:
        'ADR 0003 §2.2–2.3 + Enforcement — the hexagon core (Domain/Application/Ports in ' +
        'core-domain) must not import any adapter, app, or plugin package.',
      from: { path: '(?:^|/)packages/core-domain/' },
      to: {
        path: `(?:^|/)(?:packages/(?:${ADAPTER_PKGS})|apps|plugins)/`,
      },
    },
    {
      name: 'adapters-no-cross-adapter',
      severity: 'error',
      comment:
        'ADR 0003 §2.3 — adapters implement ports and must not import each other; shared ' +
        'logic belongs in the core behind a port.',
      from: { path: `(?:^|/)packages/(${ADAPTER_PKGS})/` },
      to: {
        path: `(?:^|/)packages/(?:${ADAPTER_PKGS})/`,
        pathNot: '(?:^|/)packages/$1/',
      },
    },
    {
      name: 'plugins-only-sdk',
      severity: 'error',
      comment:
        "ADR 0003 §2.4 + ADR 0006 §1 + ADR 0010 §3 — a plugin's only core dependency is " +
        '@grimora/plugin-sdk (plus @grimora/shared-types); it must never import core internals, ' +
        'adapters, apps, or **another plugin** (ADR 0010 §3 hard boundary: no reaching into another ' +
        "plugin's namespace/state). A plugin may still import its *own* files (the `plugins/$1/` " +
        'self-exception below).',
      // `([^/]+)` captures the plugin package name as $1 so the self-exception can allow a plugin
      // to import its own modules while still forbidding plugin→other-plugin imports.
      from: { path: '(?:^|/)plugins/([^/]+)/' },
      to: {
        path: '(?:^|/)(?:packages|apps|plugins)/',
        pathNot: '(?:^|/)(?:packages/(?:plugin-sdk|shared-types)|plugins/$1)/',
      },
    },
    {
      name: 'plugins-no-node-builtins',
      severity: 'error',
      comment:
        'ADR 0006 §3 + ADR 0010 §3 — plugin code has **no ambient authority**: no filesystem, ' +
        'network, timers or globals. Like the Domain, a plugin obtains everything through the ' +
        'injected SDK/host surface, never Node core/builtin modules (mirrors domain-no-node-builtins).',
      from: { path: '(?:^|/)plugins/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'shared-types-is-a-leaf',
      severity: 'error',
      comment:
        'ADR 0003 §3 — shared-types is the leaf (pure types, importable everywhere); it must not ' +
        "import any other workspace package, so Domain/adapter/plugin vocabulary can't creep into it " +
        '(external ADR review follow-up, point A).',
      from: { path: '(?:^|/)packages/shared-types/' },
      to: {
        path: '(?:^|/)(?:packages|apps|plugins)/',
        pathNot: '(?:^|/)packages/shared-types/',
      },
    },
    {
      name: 'no-deep-import',
      severity: 'error',
      comment:
        'ADR 0003 §2.6 / §5 — a module imports another package via its public entry ' +
        "(@grimora/x → src/index.ts), never via a deep internal path into another package's src. " +
        'Governs imports **from packages, apps *and* plugins** (an app/plugin deep-importing a ' +
        "package's internals is the same violation). Legitimate `@grimora/x` bare imports resolve " +
        'via the package `exports`/symlink, not to a `src/` path, so they never match this.',
      from: { path: '(?:^|/)(?:packages|apps|plugins)/([^/]+)/' },
      to: {
        path: '(?:^|/)packages/([^/]+)/src/',
        pathNot: '(?:^|/)packages/$1/',
      },
    },
    {
      name: 'secrets-port-composition-root-only',
      severity: 'error',
      comment:
        'ADR 0010 §4/§7 + ADR 0003 §6.4 — SecretsPort (and any secrets adapter) may be imported ' +
        'only by composition roots (apps/*); never from Domain, Application, or plugins. ' +
        '**Layout contract (explicit, so this path rule can actually bite):** SecretsPort MUST be ' +
        'declared in its own module `packages/core-domain/src/application/ports/secrets.ts` — NOT ' +
        'folded into the shared `application/ports.ts` barrel, because a path-based rule cannot ' +
        'discriminate a single interface inside a shared file, which would leave this (the most ' +
        'security-critical) rule silently dead. Enforced when SecretsPort is introduced (Phase 2).',
      from: { pathNot: '(?:^|/)apps/' },
      to: { path: '(?:^|/)packages/core-domain/src/application/ports/secrets' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.base.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: ['(?:^|/)node_modules/'] },
    exclude: { path: ['(?:^|/)node_modules/', '(?:^|/)dist/', '\\.test\\.ts$'] },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['types', 'import', 'require', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
