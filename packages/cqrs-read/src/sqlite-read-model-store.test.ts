/**
 * Proves the SQLite read-model adapter (a) satisfies the shared `ReadModelStorePort` contract — the same
 * cases the in-memory fake passes, so the two are interchangeable (ADR 0017 port-contract tests) — and
 * (b) is genuinely durable across a close/reopen and that `clear()` persists (rebuild precondition).
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readModelStoreContract } from '@grimora/core-domain/testing';
import { createSqliteReadModelStore } from './index';

describe('ReadModelStorePort contract — SQLite adapter (in-memory)', () => {
  for (const contractCase of readModelStoreContract()) {
    test(contractCase.name, async () => {
      const store = createSqliteReadModelStore();
      try {
        await contractCase.run(store);
      } finally {
        store.close();
      }
    });
  }
});

describe('SQLite read-model adapter — durability', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grimora-cqrs-read-'));
  const file = join(dir, 'reads.sqlite');

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('read models and checkpoints survive a close/reopen', async () => {
    const first = createSqliteReadModelStore({ filename: file });
    await first.put('characterSheet', 'c1', { name: 'Alrik', n: 12 });
    await first.setCheckpoint('characterSheet', 9);
    first.close();

    expect(existsSync(file)).toBe(true);

    const reopened = createSqliteReadModelStore({ filename: file });
    try {
      const got = await reopened.get<{ name: string; n: number }>('characterSheet', 'c1');
      expect(got).toEqual({ name: 'Alrik', n: 12 });
      expect(await reopened.getCheckpoint('characterSheet')).toBe(9);
    } finally {
      reopened.close();
    }
  });

  test('clear() persists — a reopened store sees an empty, position-0 state', async () => {
    const file2 = join(dir, 'reads2.sqlite');
    const store = createSqliteReadModelStore({ filename: file2 });
    await store.put('characterSheet', 'c1', { name: 'Alrik' });
    await store.setCheckpoint('characterSheet', 5);
    await store.clear();
    store.close();

    const reopened = createSqliteReadModelStore({ filename: file2 });
    try {
      expect(await reopened.get('characterSheet', 'c1')).toBeUndefined();
      expect(await reopened.getCheckpoint('characterSheet')).toBe(0);
    } finally {
      reopened.close();
    }
  });
});
