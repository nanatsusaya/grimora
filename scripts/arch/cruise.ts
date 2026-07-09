/**
 * Thin wrapper around the dependency-cruiser programmatic API, shared by the arch tests.
 *
 * Uses the JS API (not the CLI) so the harness runs identically on Windows and CI Linux
 * with no subprocess/shell/`.bin` differences, and so we can filter to the module
 * directories that actually exist (the CLI errors on a missing `apps`/`plugins`).
 */
import { existsSync } from 'node:fs';
import { cruise } from 'dependency-cruiser';
import config from '../../.dependency-cruiser.cjs';

/**
 * One dependency-cruiser rule violation, flattened to the fields the arch tests assert on (which rule
 * fired and the offending edge) — kept minimal on purpose so the tests don't couple to the full
 * dependency-cruiser result shape.
 */
export interface BoundaryViolation {
  /** Name of the forbidden rule that fired (matches a rule `name` in `.dependency-cruiser.cjs`). */
  readonly rule: string;
  /** Module the illegal import starts from. */
  readonly from: string;
  /** Module it illegally imports. */
  readonly to: string;
}

/**
 * The summarised cruise outcome the arch tests consume: pass/fail counts + the flattened violations.
 * `errors > 0` is the signal a boundary was crossed (the self-test asserts a fixture trips this).
 */
export interface BoundaryReport {
  /** Number of `error`-severity violations — non-zero means the build must fail. */
  readonly errors: number;
  /** Number of `warn`-severity violations (informational; not a build failure). */
  readonly warnings: number;
  /** How many modules were actually cruised (a sanity check that the run saw real files). */
  readonly modules: number;
  /** Every violation found, flattened — see {@link BoundaryViolation}. */
  readonly violations: BoundaryViolation[];
}

/** The monorepo roots that hold governed modules (ADR 0003 §3). */
export const MODULE_DIRS = ['packages', 'apps', 'plugins'] as const;

/** Only the module roots that currently exist — most are still scaffold-to-be. */
export function existingModuleDirs(): string[] {
  return MODULE_DIRS.filter((dir) => existsSync(dir));
}

/**
 * Cruise a set of paths against the shared ruleset and return the summarised {@link BoundaryReport}.
 * Uses the programmatic API (not the CLI) so results are structured and the run is OS-independent.
 * @param paths  the directories/files to analyse (e.g. the real module roots, or a fixtures tree)
 * @returns      the flattened pass/fail summary the arch tests assert on
 */
export async function cruisePaths(paths: string[]): Promise<BoundaryReport> {
  const result = await cruise(paths, {
    ...config.options,
    ruleSet: { forbidden: config.forbidden },
    validate: true,
  });

  if (typeof result.output === 'string') {
    throw new Error('dependency-cruiser returned a string report; expected structured output');
  }

  const { summary } = result.output;
  return {
    errors: summary.error,
    warnings: summary.warn,
    modules: summary.totalCruised,
    violations: summary.violations.map((violation) => ({
      rule: violation.rule.name,
      from: violation.from,
      to: violation.to,
    })),
  };
}

/**
 * Render violations as a readable multi-line string for a failing test's error message (so a broken
 * boundary names the exact offending edges rather than an opaque count).
 * @param violations  the violations to render
 * @returns           one `rule: from → to` line per violation
 */
export function formatViolations(violations: BoundaryViolation[]): string {
  return violations.map((v) => `  ${v.rule}: ${v.from} → ${v.to}`).join('\n');
}
