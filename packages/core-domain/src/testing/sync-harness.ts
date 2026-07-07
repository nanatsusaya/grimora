/**
 * A multi-client sync-simulation harness (ADR 0017 §1) over in-memory stores, exercising ADR 0005 §3/§4:
 * insert-only replication + **domain rebase**. It demonstrates the ADR 0022 §9 pass criteria for sync:
 *
 * - **Convergence:** a client's un-synced *write intents* are rebased onto the cloud's latest state on
 *   push (re-applying the intent via the same use case → new event at the next version), so concurrent
 *   edits to *different* attributes auto-merge (ADR 0005 §4). Clients then re-materialize from the cloud.
 * - **Roll carry:** a `character.checkRolled` event is a **fact** — on push it is *replicated* to the
 *   cloud (insert-only, ADR 0005 §3), never re-executed, so its result/seed/`requestId` are preserved
 *   (ADR 0022 §6). A re-roll on another client would produce a different `requestId`.
 *
 * The plugin is injected (a plugin cannot be imported by `core-domain` — `core-no-adapters`). This is a
 * validation harness, not a production sync engine: the cloud is the canonical merge point and clients
 * re-materialize from it, rather than maintaining divergent local optimistic overlays.
 */

import type { GrimoraPlugin } from "@grimora/plugin-sdk";
import type { EntityId } from "@grimora/shared-types";
import { createPluginHost } from "../application/plugin-host";
import type { Actor } from "../application/ports";
import {
  type CommandDeps,
  createCampaign,
  createCharacter,
  setAttribute,
} from "../application/use-cases";
import type { CampaignCreated, CharacterAttributeSet, CharacterCreated } from "../domain/events";
import {
  createFixedClock,
  createInMemoryEventStore,
  createOwnerPolicy,
  createSequentialIdGenerator,
  type InMemoryEventStore,
} from "./fakes";

/** One simulated device: its local store + a deps bundle wired to it. */
export interface HarnessClient {
  readonly idPrefix: string;
  readonly store: InMemoryEventStore;
  readonly deps: CommandDeps;
}

/** The sync harness: a canonical cloud store + factory/sync operations over clients. */
export interface SyncHarness {
  /** The canonical cloud event log (the merge authority, ADR 0005 §3). */
  readonly cloud: InMemoryEventStore;
  /** Deps wired to the cloud — used to re-apply (rebase) write intents onto the latest cloud state. */
  readonly cloudDeps: CommandDeps;
  /** Create a fresh client whose id prefix keeps its event ids globally unique. */
  createClient(idPrefix: string): HarnessClient;
  /** Push a client's un-synced events to the cloud: rebase write intents, replicate roll facts. */
  push(client: HarnessClient): Promise<void>;
  /** Re-materialize a client from the cloud (drops stale local events; ADR 0005 §3 replication). */
  pull(client: HarnessClient): Promise<void>;
}

/** Build a deps bundle (host loaded with `plugin`) wired to a given store, with an id prefix. */
function wireDeps(store: InMemoryEventStore, plugin: GrimoraPlugin, idPrefix: string): CommandDeps {
  const host = createPluginHost();
  host.load(plugin);
  return {
    events: store,
    ids: createSequentialIdGenerator(idPrefix),
    clock: createFixedClock(),
    policy: createOwnerPolicy(),
    rules: host,
  };
}

/** Create a sync harness whose clients all load the injected `plugin`. */
export function createSyncHarness(plugin: GrimoraPlugin): SyncHarness {
  const cloud = createInMemoryEventStore();
  const cloudDeps = wireDeps(cloud, plugin, "C");

  return {
    cloud,
    cloudDeps,
    createClient(idPrefix: string): HarnessClient {
      const store = createInMemoryEventStore();
      return { idPrefix, store, deps: wireDeps(store, plugin, idPrefix) };
    },

    async push(client: HarnessClient): Promise<void> {
      const cloudIds = new Set(cloud.snapshotAll().map((e) => e.id));
      const localOnly = client.store.snapshotAll().filter((e) => !cloudIds.has(e.id));
      for (const event of localOnly) {
        const actor: Actor = { userId: event.metadata?.actorId ?? ("" as EntityId) };
        switch (event.type) {
          case "campaign.created": {
            const p = event.payload as CampaignCreated["payload"];
            await createCampaign(cloudDeps, { campaignId: event.aggregateId, name: p.name, actor });
            break;
          }
          case "character.created": {
            const p = event.payload as CharacterCreated["payload"];
            await createCharacter(cloudDeps, {
              characterId: event.aggregateId,
              name: p.name,
              campaignId: p.campaignId,
              ruleSystemId: p.ruleSystemId,
              actor,
            });
            break;
          }
          case "character.attributeSet": {
            // Rebase: re-apply the intent onto the cloud's latest state → auto-merges (ADR 0005 §4).
            const p = event.payload as CharacterAttributeSet["payload"];
            await setAttribute(cloudDeps, {
              characterId: event.aggregateId,
              attributeId: p.attributeId,
              value: p.value,
              actor,
            });
            break;
          }
          case "character.checkRolled": {
            // A roll is a fact — replicate it, never re-roll (ADR 0022 §6).
            await cloud.replicate([event]);
            break;
          }
        }
      }
    },

    async pull(client: HarnessClient): Promise<void> {
      client.store.reset();
      await client.store.replicate(cloud.snapshotAll());
    },
  };
}
