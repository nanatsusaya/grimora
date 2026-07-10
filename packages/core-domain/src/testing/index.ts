/**
 * `@grimora/core-domain/testing` — reusable in-memory fakes + the multi-client sync-simulation harness
 * (ADR 0017 R1). Published as a subpath so tests **and** the composition root reuse them without the
 * fakes leaking into the main `@grimora/core-domain` entry / production bundles.
 */

export { type EventStoreContractCase, eventStoreContract } from './event-store-contract';
export {
  createFixedClock,
  createInMemoryEventStore,
  createInMemoryReadModelStore,
  createOwnerPolicy,
  createScriptedAiProvider,
  createSequentialIdGenerator,
  type InMemoryEventStore,
} from './fakes';
export {
  type ReadModelStoreContractCase,
  readModelStoreContract,
} from './read-model-store-contract';
export { createSyncHarness, type HarnessClient, type SyncHarness } from './sync-harness';
