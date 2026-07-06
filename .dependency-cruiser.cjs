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
 * Run via `bun run arch`. Referenced ADR sections are cited per rule.
 */

const ADAPTER_PKGS = "event-store|cqrs-read|offline-sync|ai-agent";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "ADR 0003 §2.7 — package/module graph must be a DAG (no cycles between modules).",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-no-application",
      severity: "error",
      comment:
        "ADR 0003 §1 — the Domain layer depends on shared-types only; it must not import " +
        "the Application layer (dependencies flow Application → Domain, never back).",
      from: { path: "(?:^|/)packages/core-domain/src/domain/" },
      to: { path: "(?:^|/)packages/core-domain/src/application/" },
    },
    {
      name: "domain-no-node-builtins",
      severity: "error",
      comment:
        "ADR 0003 §6.1 — no ambient authority: Domain obtains all I/O, time, randomness and " +
        "network only through injected ports, never Node core/builtin modules.",
      from: { path: "(?:^|/)packages/core-domain/src/domain/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "core-no-adapters",
      severity: "error",
      comment:
        "ADR 0003 §2.2–2.3 + Enforcement — the hexagon core (Domain/Application/Ports in " +
        "core-domain) must not import any adapter, app, or plugin package.",
      from: { path: "(?:^|/)packages/core-domain/" },
      to: {
        path: `(?:^|/)(?:packages/(?:${ADAPTER_PKGS})|apps|plugins)/`,
      },
    },
    {
      name: "adapters-no-cross-adapter",
      severity: "error",
      comment:
        "ADR 0003 §2.3 — adapters implement ports and must not import each other; shared " +
        "logic belongs in the core behind a port.",
      from: { path: `(?:^|/)packages/(${ADAPTER_PKGS})/` },
      to: {
        path: `(?:^|/)packages/(?:${ADAPTER_PKGS})/`,
        pathNot: "(?:^|/)packages/$1/",
      },
    },
    {
      name: "plugins-only-sdk",
      severity: "error",
      comment:
        "ADR 0003 §2.4 + ADR 0006 §1 — a plugin's only core dependency is @grimora/plugin-sdk " +
        "(plus @grimora/shared-types); it must never import core internals, adapters, or apps.",
      from: { path: "(?:^|/)plugins/" },
      to: {
        path: "(?:^|/)(?:packages|apps)/",
        pathNot: "(?:^|/)packages/(?:plugin-sdk|shared-types)/",
      },
    },
    {
      name: "shared-types-is-a-leaf",
      severity: "error",
      comment:
        "ADR 0003 §3 — shared-types is the leaf (pure types, importable everywhere); it must not " +
        "import any other workspace package, so Domain/adapter/plugin vocabulary can't creep into it " +
        "(external ADR review follow-up, point A).",
      from: { path: "(?:^|/)packages/shared-types/" },
      to: {
        path: "(?:^|/)(?:packages|apps|plugins)/",
        pathNot: "(?:^|/)packages/shared-types/",
      },
    },
    {
      name: "no-deep-import",
      severity: "error",
      comment:
        "ADR 0003 §2.6 / §5 — packages import another package via its public entry " +
        "(@grimora/x → src/index.ts), never via deep internal paths into another package's src.",
      from: { path: "(?:^|/)packages/([^/]+)/" },
      to: {
        path: "(?:^|/)packages/([^/]+)/src/",
        pathNot: "(?:^|/)packages/$1/",
      },
    },
    {
      name: "secrets-port-composition-root-only",
      severity: "error",
      comment:
        "ADR 0010 §4/§7 + ADR 0003 §6.4 — SecretsPort (and any secrets adapter) may be imported " +
        "only by composition roots (apps/*); never from Domain, Application, or plugins.",
      from: { pathNot: "(?:^|/)apps/" },
      to: { path: "(?:^|/)packages/core-domain/src/application/ports/secrets" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.base.json" },
    tsPreCompilationDeps: true,
    doNotFollow: { path: ["(?:^|/)node_modules/"] },
    exclude: { path: ["(?:^|/)node_modules/", "(?:^|/)dist/", "\\.test\\.ts$"] },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["types", "import", "require", "default"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    },
  },
};
