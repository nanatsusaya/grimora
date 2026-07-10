/**
 * Runs the shared `EventStorePort` contract against the **in-memory fake** — the baseline that proves the
 * contract itself is satisfiable and pins the fake's behaviour, so the SQLite adapter (which runs the
 * exact same cases in `@grimora/event-store`) is held to a spec the reference implementation also meets.
 */

import { describe, test } from 'bun:test';
import { eventStoreContract } from './event-store-contract';
import { createInMemoryEventStore } from './fakes';

describe('EventStorePort contract — in-memory fake', () => {
  for (const contractCase of eventStoreContract()) {
    test(contractCase.name, async () => {
      await contractCase.run(createInMemoryEventStore());
    });
  }
});
