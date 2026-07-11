/**
 * Default-deny fitness function (ADR 0010 §2/§7, ADR 0009 §3): every Application command handler
 * ("use case") reaches an explicit `PolicyPort` check before it does anything else observable. This is
 * a call-graph assertion `.dependency-cruiser.cjs` cannot express (a use case importing `ports.ts` says
 * nothing about whether it actually *calls* `policy.can`), so it is a targeted ts-morph scan instead:
 * every exported async function in `application/use-cases.ts` must contain a call whose callee text
 * matches `<something>.policy.can(` or `deps.policy.can(` (the two call shapes the codebase uses today,
 * a destructured `policy` or a `deps.policy` property access).
 */
import { describe, expect, test } from 'bun:test';
import { Project, SyntaxKind } from 'ts-morph';

/** The single module every command handler lives in (ADR 0011 §1: intent-named commands, not REST CRUD). */
const USE_CASES_FILE = 'packages/core-domain/src/application/use-cases.ts';

/**
 * Matches the callee text of a `CallExpression` (never includes the invocation parens) for
 * `deps.policy.can`, `policy.can`, or any `<x>.policy.can` property-access shape.
 */
const POLICY_CHECK_PATTERN = /(^|\.)policy\.can$/;

describe('default-deny (ADR 0010 §2/§7)', () => {
  test('every exported use case calls PolicyPort.can before returning ok', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    });
    const sourceFile = project.addSourceFileAtPath(USE_CASES_FILE);

    const uncheckedUseCases: string[] = [];
    for (const fn of sourceFile.getFunctions()) {
      if (!fn.isExported()) continue;
      const name = fn.getName() ?? '(anonymous)';
      const body = fn.getBody();
      const hasCheck =
        body !== undefined &&
        body
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((call) => POLICY_CHECK_PATTERN.test(call.getExpression().getText()));
      if (!hasCheck) uncheckedUseCases.push(name);
    }

    if (uncheckedUseCases.length > 0) {
      throw new Error(
        `Use case(s) with no PolicyPort.can check (default-deny violation): ${uncheckedUseCases.join(', ')}`,
      );
    }
    expect(uncheckedUseCases.length).toBe(0);
  });

  test('the scan actually catches a deliberate violation (self-test, in-memory fixture)', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      useInMemoryFileSystem: true,
    });
    const sourceFile = project.createSourceFile(
      '/use-cases.ts',
      [
        'export async function checked(deps: unknown, input: unknown) {',
        '  if (!deps.policy.can(input.actor, "x", {})) return;',
        '}',
        'export async function unchecked(deps: unknown, input: unknown) {',
        '  return deps.events.append();',
        '}',
      ].join('\n'),
    );

    const flagged: string[] = [];
    for (const fn of sourceFile.getFunctions()) {
      const body = fn.getBody();
      const hasCheck =
        body !== undefined &&
        body
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((call) => POLICY_CHECK_PATTERN.test(call.getExpression().getText()));
      if (!hasCheck) flagged.push(fn.getName() ?? '(anonymous)');
    }
    expect(flagged).toEqual(['unchecked']);
  });
});
