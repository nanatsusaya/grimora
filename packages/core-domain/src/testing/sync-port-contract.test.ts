/**
 * Runs the shared `SyncPort` contract against the **in-memory fake** — the baseline that proves the
 * contract is satisfiable and pins the fake's behaviour, so the real sync adapter (custom HTTP over
 * `apps/api`, #107 PR C/D) is later held to a spec the reference implementation already meets.
 */

import { describe, test } from 'bun:test';
import { createInMemorySyncPort } from './fakes';
import { syncPortContract } from './sync-port-contract';

describe('SyncPort contract — in-memory fake', () => {
  for (const contractCase of syncPortContract()) {
    test(contractCase.name, async () => {
      await contractCase.run(createInMemorySyncPort());
    });
  }
});
