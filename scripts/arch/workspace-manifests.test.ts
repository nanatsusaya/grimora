/**
 * Fitness function: every workspace package follows the module conventions from ADR 0003 §5
 * (@grimora-scoped name, private, ESM, a single public `src/index.ts` entry). Guarantees a
 * newly added module is covered by the harness's expectations from the moment it appears.
 */

import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MODULE_DIRS } from './cruise';

interface WorkspacePackage {
  readonly dir: string;
  readonly root: string;
}

function workspacePackageDirs(): WorkspacePackage[] {
  const dirs: WorkspacePackage[] = [];
  for (const root of MODULE_DIRS) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const dir = join(root, name);
      if (statSync(dir).isDirectory() && existsSync(join(dir, 'package.json'))) {
        dirs.push({ dir, root });
      }
    }
  }
  return dirs;
}

describe('workspace manifest conventions (ADR 0003 §5)', () => {
  const dirs = workspacePackageDirs();

  test('at least one workspace package exists', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  for (const { dir, root } of dirs) {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

    describe(dir, () => {
      test('name is @grimora-scoped', () => {
        expect(typeof manifest.name).toBe('string');
        expect((manifest.name as string).startsWith('@grimora/')).toBe(true);
      });

      test('is private and an ES module', () => {
        expect(manifest.private).toBe(true);
        expect(manifest.type).toBe('module');
      });

      // The "single public entry" convention (ADR 0003 §5) governs *imported* packages, so a consumer
      // has one stable entry and no deep imports. Apps under `apps/*` are composition roots — executable
      // entry points that nobody imports (ADR 0003 §1) — so they are exempt; their entry is their run
      // script (e.g. `src/walk.ts`), not a library `src/index.ts`.
      if (root !== 'apps') {
        test('has a single public entry (src/index.ts)', () => {
          expect(existsSync(join(dir, 'src', 'index.ts'))).toBe(true);
        });
      }
    });
  }
});
