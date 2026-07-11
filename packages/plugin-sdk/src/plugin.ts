/**
 * Plugin registration: the manifest, the rule-system definition a plugin contributes, and the
 * `definePlugin`/`register` entry point (ADR 0006 §3). A plugin is a bounded context whose only core
 * dependency is this SDK (ADR 0003 §2.4 / ADR 0006 §1); the host calls `register(registry)` to collect
 * its contributions and translate at the boundary (the Anti-Corruption Layer, ADR 0003 §9).
 *
 * **Provisional v0** (ADR 0022 §3) — frozen later in ADR 0025. The skeleton exposes a single
 * capability (rule system); themes/content-packs/AI-tools/UI-slots (ADR 0006 §2) are not built here.
 */

import type { CheckDefinition } from '@grimora/rules-contract';
import type { TraitDefinition } from './traits';

/**
 * The plugin manifest (ADR 0006 §4). The skeleton uses the minimum: a reverse-DNS `id`, a display
 * `name`, a semver `version`, and the SDK major it targets. Content-boundary/permissions declarations
 * (ADR 0006 §4/§8) are deferred to the frozen contract (ADR 0025).
 */
export interface PluginManifest {
  /** Reverse-DNS plugin id, e.g. "org.grimora.dsa5". */
  readonly id: string;
  /** Human-readable plugin name. */
  readonly name: string;
  /** Plugin semver, e.g. "0.0.0". */
  readonly version: string;
  /** The SDK major version this plugin targets (compatibility gate, ADR 0006 §4). */
  readonly sdkVersion: number;
}

/**
 * The rule-system capability's content (ADR 0006 §2, ADR 0020): the concrete traits and checks that
 * populate the core's generic meta-model. The core stores/edits these generically; the plugin gives
 * them meaning.
 */
export interface RuleSystemDefinition {
  /** Rule-system id bound per character/campaign (ADR 0006 §9), e.g. "dsa5". */
  readonly id: string;
  /** i18n key for the rule-system's display name. */
  readonly labelKey: string;
  /** The trait slots this rule system declares (attributes, skills, derived values). */
  readonly traits: readonly TraitDefinition[];
  /** The checks this rule system declares (their dice mechanic lives in each `resolve`). */
  readonly checks: readonly CheckDefinition[];
}

/**
 * The typed registry a plugin's `register` function writes its contributions into (ADR 0006 §3). The
 * skeleton supports one capability; the host implements this interface when loading the plugin.
 */
export interface PluginRegistry {
  /** Contribute a rule system (ADR 0006 §2 rule-system capability). */
  registerRuleSystem(definition: RuleSystemDefinition): void;
}

/** The registration callback a plugin exports; the host calls it with a live registry. */
export type RegisterFn = (registry: PluginRegistry) => void;

/** A defined plugin: its manifest plus its registration callback (the value `definePlugin` returns). */
export interface GrimoraPlugin {
  readonly manifest: PluginManifest;
  readonly register: RegisterFn;
}

/**
 * The plugin entry point (ADR 0006 §3): a plugin module default-exports `definePlugin(manifest,
 * register)`. Kept dependency-free and pure so a plugin never performs ambient I/O at definition time.
 *
 * @param manifest  the plugin's manifest (id/name/version/sdkVersion)
 * @param register  callback that adds the plugin's contributions to the host registry
 * @returns         the `GrimoraPlugin` the host loads
 */
export function definePlugin(manifest: PluginManifest, register: RegisterFn): GrimoraPlugin {
  return { manifest, register };
}
