/**
 * Fitness function: the import-boundary rules (ADR 0003 §2 dependency rule, §6 security,
 * ADR 0010 §7) hold across the real module tree — and, crucially, actually *bite* when a
 * boundary is crossed (proven against deliberate-violation fixtures, per issue #9's
 * acceptance: "a deliberate boundary violation makes it fail").
 */
import { describe, expect, test } from "bun:test";
import { cruisePaths, existingModuleDirs, formatViolations } from "./cruise";

describe("architecture boundaries (ADR 0003 §2)", () => {
  test("the real module tree has zero boundary violations", async () => {
    const dirs = existingModuleDirs();
    expect(dirs.length).toBeGreaterThan(0);

    const report = await cruisePaths(dirs);
    if (report.errors > 0) {
      throw new Error(`Boundary violations found:\n${formatViolations(report.violations)}`);
    }
    expect(report.errors).toBe(0);
  });

  test("the ruleset catches deliberate violations (self-test)", async () => {
    const report = await cruisePaths(["scripts/arch/__fixtures__/violations"]);
    const firedRules = new Set(report.violations.map((v) => v.rule));

    // If these ever stop firing, the harness has gone blind — fail loudly.
    expect(report.errors).toBeGreaterThan(0);
    expect(firedRules.has("core-no-adapters")).toBe(true);
    expect(firedRules.has("plugins-only-sdk")).toBe(true);
    expect(firedRules.has("shared-types-is-a-leaf")).toBe(true);
  });
});
