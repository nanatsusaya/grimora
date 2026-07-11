/**
 * Fitness function: the import-boundary rules (ADR 0003 §2 dependency rule, §6 security,
 * ADR 0010 §7) hold across the real module tree — and, crucially, actually *bite* when a
 * boundary is crossed (proven against deliberate-violation fixtures, per issue #9's
 * acceptance: "a deliberate boundary violation makes it fail").
 */
import { describe, expect, test } from 'bun:test';
import { cruisePaths, existingModuleDirs, formatViolations } from './cruise';

describe('architecture boundaries (ADR 0003 §2)', () => {
  test('the real module tree has zero boundary violations', async () => {
    const dirs = existingModuleDirs();
    expect(dirs.length).toBeGreaterThan(0);

    const report = await cruisePaths(dirs);
    if (report.errors > 0) {
      throw new Error(`Boundary violations found:\n${formatViolations(report.violations)}`);
    }
    expect(report.errors).toBe(0);
  });

  test('the ruleset catches deliberate violations (self-test)', async () => {
    const report = await cruisePaths(['scripts/arch/__fixtures__/violations']);
    const firedRules = new Set(report.violations.map((v) => v.rule));

    // If these ever stop firing, the harness has gone blind — fail loudly. Every rule listed here
    // has a dedicated fixture under __fixtures__/violations; expand both together when adding rules.
    expect(report.errors).toBeGreaterThan(0);
    expect(firedRules.has('core-no-adapters')).toBe(true);
    expect(firedRules.has('plugins-only-sdk')).toBe(true);
    expect(firedRules.has('shared-types-is-a-leaf')).toBe(true);
    // Newly-covered scope holes (this PR): plugin→plugin imports, plugin→Node-builtins, and deep
    // internal imports (the imports-adapter fixture also deep-imports another package's src).
    expect(firedRules.has('plugins-no-node-builtins')).toBe(true);
    expect(firedRules.has('no-deep-import')).toBe(true);
    // #76: plugin-sdk is the published host/plugin language and must not import a concrete plugin
    // package either (ADR 0003 §9 boundary/language-leak).
    expect(firedRules.has('sdk-no-plugin-leak')).toBe(true);
    // #76: UI code outside a composition root must not import the event-store adapter directly
    // (ADR 0012 §11), and a production app must not import core-domain's dev-only /testing subpath
    // (ADR 0017 R1).
    expect(firedRules.has('ui-reads-read-models-only')).toBe(true);
    expect(firedRules.has('testing-subpath-production-guard')).toBe(true);
  });
});
