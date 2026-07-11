/**
 * Determinism fitness function (ADR 0021 §3, ADR 0010 §7): no wall-clock or non-seeded-random API is
 * reachable from the formula interpreter or the dice-roll runtime a plugin's Behaviour API calls run
 * under. Replaying an event stream must reproduce identical rolls (ADR 0022 §9 pass criterion 2) — a
 * stray `Math.random()`/`Date.now()`/`new Date()` anywhere in this reachable surface would silently
 * break that guarantee. Scoped to the three places that surface could hide:
 *
 *  - `packages/core-domain/src/domain/` — the formula interpreter (`formula.ts`) and the seeded RNG
 *    (`rng.ts`) it and `character.ts`'s `rollCheck` decide-function depend on.
 *  - `packages/plugin-sdk/src/` — the published contract (`formula.ts`/`dice.ts`/`behaviour.ts`) a
 *    plugin's Behaviour API implementations are typed against.
 *  - `plugins/*\/src/` — a plugin's own `resolve` functions and other Behaviour API code (arbitrary
 *    plugin-authored JS the host executes, e.g. a check's `resolve` callback), which is exactly the
 *    "reachable from plugin Behaviour API calls" surface ADR 0021 §3 names.
 *
 * This is a call/AST scan (ts-morph), not an import-boundary rule: `Math`/`Date` are ambient globals,
 * not imports, so `.dependency-cruiser.cjs` cannot express this check.
 */
import { describe, expect, test } from 'bun:test';
import { Node, Project, SyntaxKind } from 'ts-morph';

/** Source roots the determinism rule governs (see the file header for why each is in scope). */
const SRC_GLOBS = [
  'packages/core-domain/src/domain/**/*.ts',
  'packages/plugin-sdk/src/**/*.ts',
  'plugins/*/src/**/*.ts',
];

/** Test files and deliberate-violation fixtures are not product code — excluded from the scan. */
const EXCLUDE = /\.test\.ts$|__fixtures__/;

/**
 * Scan a project's governed source files for a forbidden wall-clock/non-seeded-random call, returning
 * one violation string per offending call site.
 * @param project  a ts-morph project already loaded with the governed source globs
 * @returns        `"path:line — <expression>"` for every forbidden call found
 */
function findViolations(project: Project): string[] {
  const violations: string[] = [];
  const cwd = process.cwd().replace(/\\/g, '/');

  for (const sourceFile of project.getSourceFiles()) {
    const abs = sourceFile.getFilePath();
    if (EXCLUDE.test(abs)) continue;
    const rel = abs.replace(`${cwd}/`, '');

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const text = call.getExpression().getText();
      if (text === 'Math.random' || text === 'Date.now') {
        violations.push(`${rel}:${call.getStartLineNumber()} — forbidden call \`${text}()\``);
      }
    }
    for (const newExpr of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      const expr = newExpr.getExpression();
      if (Node.isIdentifier(expr) && expr.getText() === 'Date') {
        violations.push(`${rel}:${newExpr.getStartLineNumber()} — forbidden \`new Date(...)\``);
      }
    }
  }
  return violations;
}

describe('determinism (ADR 0021 §3, ADR 0010 §7)', () => {
  test('the formula interpreter, dice runtime and plugin Behaviour code never touch the wall clock or Math.random', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    });
    for (const glob of SRC_GLOBS) project.addSourceFilesAtPaths(glob);

    const violations = findViolations(project);
    if (violations.length > 0) {
      throw new Error(`Determinism violations (${violations.length}):\n${violations.join('\n')}`);
    }
    expect(violations.length).toBe(0);
  });

  test('the scan actually catches a deliberate violation (self-test, in-memory fixture)', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      useInMemoryFileSystem: true,
    });
    project.createSourceFile(
      '/violation.ts',
      'export const bad = () => [Math.random(), Date.now(), new Date()];',
    );
    const violations = findViolations(project);
    expect(violations.length).toBe(3);
  });
});
