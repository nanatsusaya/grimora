/**
 * Runs the shared `ReadModelStorePort` contract against the **in-memory fake** — the baseline that proves
 * the contract is satisfiable and pins the fake's behaviour, so the SQLite adapter (which runs the exact
 * same cases in `@grimora/cqrs-read`) is held to a spec the reference implementation also meets.
 */

import { describe, test } from 'bun:test';
import { createInMemoryReadModelStore } from './fakes';
import { readModelStoreContract } from './read-model-store-contract';

describe('ReadModelStorePort contract — in-memory fake', () => {
  for (const contractCase of readModelStoreContract()) {
    test(contractCase.name, async () => {
      await contractCase.run(createInMemoryReadModelStore());
    });
  }
});
