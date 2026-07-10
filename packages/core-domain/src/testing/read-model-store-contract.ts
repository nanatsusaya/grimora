/**
 * A **storage-engine-agnostic contract test suite** for `ReadModelStorePort` (ADR 0004 §5, ADR 0017
 * port-contract tests) — the read-side counterpart to `eventStoreContract`. It lets the in-memory fake
 * (`createInMemoryReadModelStore`) and every real adapter (SQLite today) be proven **behaviourally
 * equivalent** against one spec, so a projection that works over the fake works over the real store
 * unchanged (ADR 0003 §4 swappability).
 *
 * Like the event-store contract it is **free of any test framework** (never imports `bun:test`): it is
 * compiled into the published `@grimora/core-domain/testing` subpath, and each case is a `{ name, run }`
 * pair the consuming `*.test.ts` registers, handing `run` a fresh, empty store. A failing assertion
 * throws — the runner reports it as that named test failing.
 */

import type { ReadModelStorePort } from '../application/ports';

/**
 * One named contract case over an already-constructed, empty store. `run` throws on a contract violation.
 */
export interface ReadModelStoreContractCase {
  /** Human-readable behaviour under test, used as the registered test's name. */
  readonly name: string;
  /** Exercise the behaviour against a fresh `store`; throws (via the local assert) if the contract breaks. */
  readonly run: (store: ReadModelStorePort) => Promise<void>;
}

/** A representative JSON-serializable read-model value — nested so the round-trip proves deep fidelity. */
interface SampleModel {
  readonly name: string;
  readonly n: number;
  readonly nested: { readonly list: readonly number[]; readonly flag: boolean };
}

/** A sample read-model value used across the round-trip cases. */
const sample: SampleModel = { name: 'Alrik', n: 12, nested: { list: [1, 2, 3], flag: true } };

/**
 * Minimal assertion helper — kept local so this module needs no `node:assert` and no test framework.
 * Throws an `Error` the runner surfaces as a failure.
 * @param condition  the invariant that must hold
 * @param message    what was expected, shown when it does not
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`ReadModelStorePort contract violated: ${message}`);
}

/**
 * Assert two JSON-serializable values are deeply equal by structural (JSON) comparison — sufficient for
 * read models, which are plain serializable data (ADR 0004 §5), and avoids pulling in a deep-equal dep.
 * @param actual    the value read back from the store
 * @param expected  the value that was written
 * @param label     context for the failure message
 */
function assertJsonEqual(actual: unknown, expected: unknown, label: string): void {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

/**
 * The full contract as an ordered list of cases. Covers: put/get round-trip (deep), absent → undefined,
 * overwrite-on-put, collection isolation, the checkpoint default (0) and set/get, per-projection
 * checkpoint independence, and `clear()` wiping **both** read models and checkpoints (the rebuild-from-0
 * precondition, ADR 0004 §5).
 * @returns the ordered contract cases to register with a test runner
 */
export function readModelStoreContract(): readonly ReadModelStoreContractCase[] {
  return [
    {
      name: 'put then get returns a deep copy of the stored value',
      run: async (store) => {
        await store.put('characterSheet', 'c1', sample);
        const got = await store.get<SampleModel>('characterSheet', 'c1');
        assertJsonEqual(got, sample, 'round-trip');
      },
    },
    {
      name: 'get on an absent id returns undefined',
      run: async (store) => {
        const got = await store.get<SampleModel>('characterSheet', 'missing');
        assert(got === undefined, 'absent id must return undefined, not null/empty');
      },
    },
    {
      name: 'put overwrites an existing value (last write wins for a key)',
      run: async (store) => {
        await store.put('characterSheet', 'c1', { ...sample, n: 1 });
        await store.put('characterSheet', 'c1', { ...sample, n: 2 });
        const got = await store.get<SampleModel>('characterSheet', 'c1');
        assert(got?.n === 2, `expected the second write (n=2), got n=${got?.n}`);
      },
    },
    {
      name: 'get isolates by collection (same id in another collection is not returned)',
      run: async (store) => {
        await store.put('characterSheet', 'x', { ...sample, name: 'sheet' });
        await store.put('campaignList', 'x', { ...sample, name: 'campaign' });
        const sheet = await store.get<SampleModel>('characterSheet', 'x');
        const campaign = await store.get<SampleModel>('campaignList', 'x');
        assert(
          sheet?.name === 'sheet' && campaign?.name === 'campaign',
          'collections must not bleed',
        );
      },
    },
    {
      name: 'getCheckpoint defaults to 0 for an unseen projection',
      run: async (store) => {
        const cp = await store.getCheckpoint('characterSheet');
        assert(cp === 0, `an unseen projection must checkpoint at 0, got ${cp}`);
      },
    },
    {
      name: 'setCheckpoint then getCheckpoint returns the stored position',
      run: async (store) => {
        await store.setCheckpoint('characterSheet', 42);
        assert((await store.getCheckpoint('characterSheet')) === 42, 'checkpoint must round-trip');
        // A later set advances (and can move it, since a rebuild resets to 0 then climbs).
        await store.setCheckpoint('characterSheet', 100);
        assert((await store.getCheckpoint('characterSheet')) === 100, 'checkpoint must update');
      },
    },
    {
      name: 'checkpoints are per-projection (independent positions)',
      run: async (store) => {
        await store.setCheckpoint('characterSheet', 7);
        await store.setCheckpoint('campaignList', 3);
        assert((await store.getCheckpoint('characterSheet')) === 7, 'sheet checkpoint independent');
        assert(
          (await store.getCheckpoint('campaignList')) === 3,
          'campaign checkpoint independent',
        );
      },
    },
    {
      name: 'clear() wipes both read models and checkpoints (rebuild-from-0 precondition)',
      run: async (store) => {
        await store.put('characterSheet', 'c1', sample);
        await store.setCheckpoint('characterSheet', 55);
        await store.clear();
        assert(
          (await store.get<SampleModel>('characterSheet', 'c1')) === undefined,
          'clear() must drop read-model rows',
        );
        assert(
          (await store.getCheckpoint('characterSheet')) === 0,
          'clear() must reset checkpoints to 0 so a replay starts from position 0',
        );
      },
    },
  ];
}
