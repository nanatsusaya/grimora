/**
 * The in-process plugin host (ADR 0006 §5 — first-party plugins run in-process; the untrusted sandbox
 * is deferred to a third-party registry, ADR 0010 R1). Loading a plugin = calling its `register`
 * callback and collecting its contributions; this is the Anti-Corruption Layer boundary (ADR 0003 §9)
 * where plugin vocabulary is translated into the host's registry.
 *
 * Pure with respect to I/O (no network/filesystem) — just wiring — so it is safe in the Application
 * layer. Records each rule system's plugin provenance (ADR 0006 §4) for event stamping.
 */

import type { GrimoraPlugin, PluginRegistry, RuleSystemDefinition } from '@grimora/plugin-sdk';
import type { RuleSystemRegistryPort } from './ports';

interface Provenance {
  readonly pluginId: string;
  readonly pluginVersion: string;
}

interface Registered {
  readonly definition: RuleSystemDefinition;
  readonly provenance: Provenance;
}

/** A plugin host: loads plugins and exposes their contributions as a {@link RuleSystemRegistryPort}. */
export interface PluginHost extends RuleSystemRegistryPort {
  /** Load a plugin in-process (calls its `register`), recording its provenance. */
  load(plugin: GrimoraPlugin): void;
}

/** Create an empty in-process plugin host. */
export function createPluginHost(): PluginHost {
  const ruleSystems = new Map<string, Registered>();

  return {
    load(plugin: GrimoraPlugin): void {
      // Capture the loading plugin's provenance so each rule-system registration is stamped with it.
      const provenance: Provenance = {
        pluginId: plugin.manifest.id,
        pluginVersion: plugin.manifest.version,
      };
      const registry: PluginRegistry = {
        registerRuleSystem(definition: RuleSystemDefinition): void {
          ruleSystems.set(definition.id, { definition, provenance });
        },
      };
      plugin.register(registry);
    },
    getRuleSystem(ruleSystemId) {
      return ruleSystems.get(ruleSystemId)?.definition;
    },
    getCheck(ruleSystemId, checkId) {
      return ruleSystems.get(ruleSystemId)?.definition.checks.find((c) => c.id === checkId);
    },
    getRatedTrait(ruleSystemId, traitId) {
      const trait = ruleSystems.get(ruleSystemId)?.definition.traits.find((t) => t.id === traitId);
      // Attributes and skills are both rated (bounded) traits; derived values are computed, not set.
      return trait && (trait.kind === 'attribute' || trait.kind === 'skill')
        ? { min: trait.min, max: trait.max }
        : undefined;
    },
    getProvenance(ruleSystemId) {
      return ruleSystems.get(ruleSystemId)?.provenance;
    },
  };
}
