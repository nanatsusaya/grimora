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
 * **Scope of these rules is *import boundaries* only.** *Call-graph* / *content* fitness functions
 * dependency-cruiser cannot express (default-deny `PolicyPort`, determinism, the SDK re-export/privacy
 * completeness checks) live as separate ts-morph-based `*.test.ts` files in `scripts/arch/` instead
 * (#76 closed most of the ADR-mandated set — see `scripts/arch/README.md`'s table for the current full
 * inventory). `ui-reads-read-models-only` (ADR 0012 §11) and `testing-subpath-production-guard`
 * (ADR 0017 R1) *are* import-expressible and live below as ordinary forbidden rules. Two items remain
 * genuinely unassertable — the external-AI consent gate (ADR 0015 §10) needs `ConsentPort` to exist,
 * and realtime-never-persisted (ADR 0024 §9) needs a realtime adapter to exist — both are documented
 * `test.skip` placeholders in `scripts/arch/pending-fitness-functions.test.ts`, not silently missing.
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
      name: 'sdk-no-plugin-leak',
      severity: 'error',
      comment:
        'ADR 0003 §9 (boundary/language-leak) + ADR 0025 §7 — `plugin-sdk` is the *published* ' +
        "language between the host and plugins; it must not import a *concrete* plugin's package, " +
        'an adapter, or an app, or plugin-specific vocabulary would leak back into the one contract ' +
        'every plugin (and core-domain) depends on. (The identifier/vocabulary half of the "language ' +
        'leak" this ADR section names is structurally implied by this import rule — TS code cannot ' +
        'reference a symbol it never imported; a rule system named in a doc comment as an *example* ' +
        '(e.g. "DSA5" in a JSDoc `@example`) is documentation, not a leak, and is intentionally out of ' +
        'scope — #76.)',
      from: { path: '(?:^|/)packages/plugin-sdk/' },
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
    {
      name: 'ui-reads-read-models-only',
      severity: 'error',
      comment:
        'ADR 0012 §11 — UI/presentation code reads only through the read-model/query layer; it must ' +
        'not import the event-store adapter directly (the deep-import rule above already covers ' +
        '"or core internals" via a package\'s public entry). A composition root ' +
        '(`apps/*/src/composition/`) and its store-wiring layer (`apps/*/src/store/`) are exempt — ' +
        'they are the one place allowed to wire adapters (ADR 0003 §8); a projection-running view ' +
        '(`apps/web/src/state/`) is *not* exempt — it receives an already-wired port instance from ' +
        'the composition root rather than importing the adapter package itself, so this import rule ' +
        "correctly doesn't (and shouldn't) flag it. #76.",
      from: {
        path: '(?:^|/)(?:apps/[^/]+/src|packages/ui/src)/',
        pathNot: '(?:^|/)apps/[^/]+/src/(?:composition|store)/',
      },
      to: { path: `(?:^|/)packages/(?:${ADAPTER_PKGS})/` },
    },
    {
      name: 'testing-subpath-production-guard',
      severity: 'error',
      comment:
        'ADR 0017 R1 — `@grimora/core-domain/testing` (in-memory fakes + contract suites) is dev/test ' +
        'infrastructure and must never be imported by a production composition root. ' +
        '`apps/skeleton-walk` is exempt: it *is* the ADR 0022 walking-skeleton validation harness, ' +
        'whose entire purpose is running the golden path over in-memory fakes, never a deployed app. #76.',
      from: { path: '(?:^|/)apps/(?!skeleton-walk/)[^/]+/src/' },
      to: { path: '(?:^|/)packages/core-domain/src/testing/' },
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
