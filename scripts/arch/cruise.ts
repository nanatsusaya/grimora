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

export interface BoundaryViolation {
  rule: string;
  from: string;
  to: string;
}

export interface BoundaryReport {
  errors: number;
  warnings: number;
  modules: number;
  violations: BoundaryViolation[];
}

/** The monorepo roots that hold governed modules (ADR 0003 §3). */
export const MODULE_DIRS = ['packages', 'apps', 'plugins'] as const;

/** Only the module roots that currently exist — most are still scaffold-to-be. */
export function existingModuleDirs(): string[] {
  return MODULE_DIRS.filter((dir) => existsSync(dir));
}

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

export function formatViolations(violations: BoundaryViolation[]): string {
  return violations.map((v) => `  ${v.rule}: ${v.from} → ${v.to}`).join('\n');
}
