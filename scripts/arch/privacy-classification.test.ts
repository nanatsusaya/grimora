/**
 * Privacy-classification completeness fitness function (ADR 0023 §8): every core event type must have a
 * declared privacy classification registered in `CORE_EVENT_PRIVACY`. `domain/events.ts` already gets a
 * **per-classification** compile-time guarantee from `satisfies PrivacyClassification<Payload>` (a
 * classification object missing a payload field is a type error) — but nothing stops a developer adding
 * a *new* event type (`NewEvent<'x.y', …>`) to `CampaignEvent`/`CharacterEvent` while forgetting to add
 * its classification const **and** register it in `CORE_EVENT_PRIVACY`; TypeScript's structural typing
 * does not catch a missing registry *entry*, only a malformed one. This is exactly the "declared privacy
 * class or the type fails to load" completeness ADR 0023 §8 asks for — implemented here as the harness
 * half (a load-time/type check would need a mapped-type assertion inside `events.ts` itself, which is a
 * larger refactor than this ticket's scope; this test is the interim, always-on backstop, #76).
 */
import { describe, expect, test } from 'bun:test';
import { Node, Project, SyntaxKind } from 'ts-morph';

const EVENTS_FILE = 'packages/core-domain/src/domain/events.ts';

/**
 * Every event-type string literal used as `NewEvent<'a.b', …>`'s first type argument in the file.
 * @param sourceFile  the ts-morph source file to scan
 * @returns           the set of event `type` tags the domain declares
 */
function declaredEventTypes(sourceFile: ReturnType<Project['addSourceFileAtPath']>): Set<string> {
  const types = new Set<string>();
  for (const ref of sourceFile.getDescendantsOfKind(SyntaxKind.TypeReference)) {
    if (ref.getTypeName().getText() !== 'NewEvent') continue;
    const [first] = ref.getTypeArguments();
    if (first && Node.isLiteralTypeNode(first) && Node.isStringLiteral(first.getLiteral())) {
      types.add(first.getLiteral().getLiteralValue());
    }
  }
  return types;
}

/**
 * The string-literal property keys of the `CORE_EVENT_PRIVACY` object-literal export.
 * @param sourceFile  the ts-morph source file to scan
 * @returns           the set of event `type` tags registered for privacy classification
 */
function registeredPrivacyKeys(
  sourceFile: ReturnType<Project['addSourceFileAtPath']>,
): Set<string> {
  const decl = sourceFile.getVariableDeclarationOrThrow('CORE_EVENT_PRIVACY');
  // `CORE_EVENT_PRIVACY = { … } as const` — unwrap the `as const` to reach the object literal itself.
  let init = decl.getInitializerOrThrow();
  if (Node.isAsExpression(init)) init = init.getExpression();
  if (!Node.isObjectLiteralExpression(init)) {
    throw new Error(
      'CORE_EVENT_PRIVACY initializer is not an object literal (even after unwrapping `as const`)',
    );
  }
  const keys = new Set<string>();
  for (const prop of init.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const name = prop.getNameNode();
      const text = name.getText();
      keys.add(
        text.startsWith("'") || text.startsWith('"') ? JSON.parse(text.replace(/'/g, '"')) : text,
      );
    }
  }
  return keys;
}

describe('privacy-classification completeness (ADR 0023 §8)', () => {
  test('CORE_EVENT_PRIVACY registers every declared core event type, and only those', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    });
    const sourceFile = project.addSourceFileAtPath(EVENTS_FILE);

    const declared = declaredEventTypes(sourceFile);
    const registered = registeredPrivacyKeys(sourceFile);

    const missing = [...declared].filter((t) => !registered.has(t));
    const stale = [...registered].filter((t) => !declared.has(t));

    if (missing.length > 0 || stale.length > 0) {
      throw new Error(
        `CORE_EVENT_PRIVACY out of sync with declared event types.\n` +
          `Missing (declared but not classified): ${missing.join(', ') || '(none)'}\n` +
          `Stale (classified but no longer declared): ${stale.join(', ') || '(none)'}`,
      );
    }
    expect(declared.size).toBeGreaterThan(0);
    expect(missing.length).toBe(0);
    expect(stale.length).toBe(0);
  });

  test('the scan actually catches a deliberate omission (self-test, in-memory fixture)', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      useInMemoryFileSystem: true,
    });
    const sourceFile = project.createSourceFile(
      '/events.ts',
      [
        "export type A = NewEvent<'a.created', { x: number }>;",
        "export type B = NewEvent<'b.created', { y: number }>;",
        'export const CORE_EVENT_PRIVACY = {',
        "  'a.created': { x: 1 },",
        '} as const;',
      ].join('\n'),
    );

    const declared = declaredEventTypes(sourceFile);
    const registered = registeredPrivacyKeys(sourceFile);
    const missing = [...declared].filter((t) => !registered.has(t));
    expect(missing).toEqual(['b.created']);
  });
});
