/**
 * SDK re-export fitness function (ADR 0025 §7): the `@grimora/plugin-sdk` public entry must never
 * re-export a host/port type — the SDK is the plugin-facing contract, and a port name leaking into it
 * would let plugin code reference host vocabulary it has no business seeing (ADR 0006 §3 sandbox).
 * `sdk-no-plugin-leak` (`.dependency-cruiser.cjs`) already makes this structurally impossible via an
 * actual import (plugin-sdk cannot import core-domain without forming a cycle `no-circular` already
 * forbids), so this check catches the other way the name could leak in: a locally-authored identifier
 * inside `plugin-sdk` itself that happens to collide with a reserved port name (e.g. a copy-paste).
 *
 * The banned-name list is derived **from the live `ports.ts` exports**, not hardcoded, so it can never
 * silently go stale as new ports are added.
 */
import { describe, expect, test } from 'bun:test';
import { Project } from 'ts-morph';

const PORTS_FILE = 'packages/core-domain/src/application/ports.ts';
const SDK_ENTRY = 'packages/plugin-sdk/src/index.ts';

/**
 * Collect every top-level exported identifier name from a source file (interfaces, types, functions,
 * classes, enums, const/let/var declarations, plus re-exported names).
 * @param file  the ts-morph source file to inspect
 * @returns     the set of exported names
 */
function exportedNames(file: ReturnType<Project['addSourceFileAtPath']>): Set<string> {
  const names = new Set<string>();
  for (const [name] of file.getExportedDeclarations()) names.add(name);
  return names;
}

describe('SDK re-export boundary (ADR 0025 §7)', () => {
  test("plugin-sdk's public entry exports none of core-domain's port/host names", () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    });
    const portNames = exportedNames(project.addSourceFileAtPath(PORTS_FILE));
    const sdkNames = exportedNames(project.addSourceFileAtPath(SDK_ENTRY));

    const leaked = [...sdkNames].filter((name) => portNames.has(name));
    if (leaked.length > 0) {
      throw new Error(
        `plugin-sdk re-exports reserved core-domain port name(s): ${leaked.join(', ')}`,
      );
    }
    expect(leaked.length).toBe(0);
  });

  test('the scan actually catches a deliberate collision (self-test, in-memory fixture)', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      useInMemoryFileSystem: true,
    });
    const ports = project.createSourceFile(
      '/ports.ts',
      'export interface PolicyPort { can(): boolean; }',
    );
    const sdk = project.createSourceFile(
      '/sdk-index.ts',
      'export interface PolicyPort { can(): boolean; }\nexport interface FormulaAst { kind: string; }',
    );

    const leaked = [...exportedNames(sdk)].filter((name) => exportedNames(ports).has(name));
    expect(leaked).toEqual(['PolicyPort']);
  });
});
