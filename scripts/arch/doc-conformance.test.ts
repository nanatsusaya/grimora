/**
 * Doc-conformance fitness function (CLAUDE.md "Code documentation & comments") — the **presence** half
 * of the documentation standard, machine-checked so it cannot silently erode as Phase 2 grows (the
 * owner's "refined rule + lightweight enforcement" decision, 2026-07-09).
 *
 * Over the product source (packages/apps/plugins `src` + the arch helper) it asserts:
 *  - every **exported** declaration (function, interface, type, class, enum, const) carries a JSDoc block; and
 *  - every **exported function** (incl. exported arrow-const functions) documents **every parameter** with `@param`.
 *
 * It deliberately checks **presence, not quality** — the "why, not what" judgement stays a review
 * responsibility (CLAUDE.md). Interface *properties* and object-literal methods are **out of scope** here
 * (covered by the type header / review), to avoid the doc-for-doc's-sake noise the refined rule warns against.
 */
import { describe, expect, test } from 'bun:test';
import { type JSDocableNode, Node, type ParameteredNode, Project } from 'ts-morph';

/** Source roots governed by the doc standard (product code + the one arch helper module). */
const SRC_GLOBS = [
  'packages/*/src/**/*.ts',
  'apps/*/src/**/*.ts',
  'plugins/*/src/**/*.ts',
  'scripts/arch/cruise.ts',
];

/** Test files and deliberate-violation fixtures are not product code — excluded from the standard. */
const EXCLUDE = /\.test\.ts$|__fixtures__/;

/**
 * Build a ts-morph project over the governed source globs (AST/JSDoc only — no type resolution needed).
 * @returns a project whose source files are exactly the governed set
 */
function loadProject(): Project {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  for (const glob of SRC_GLOBS) project.addSourceFilesAtPaths(glob);
  return project;
}

/**
 * Collect the parameter names a node's JSDoc blocks document via `@param`.
 * @param jsDocs  the JSDoc blocks attached to a function/const declaration
 * @returns       the set of documented parameter names (top-level name before any dotted path)
 */
function documentedParams(jsDocs: ReturnType<JSDocableNode['getJsDocs']>): Set<string> {
  const names = new Set<string>();
  for (const doc of jsDocs) {
    for (const tag of doc.getTags()) {
      if (Node.isJSDocParameterTag(tag)) {
        names.add(tag.getName().split('.')[0] as string);
      }
    }
  }
  return names;
}

/**
 * Check that a parametered, JSDoc-able node documents each of its parameters with `@param`.
 * @param node    the function-like node (function decl or arrow/function const initializer)
 * @param jsDocs  the JSDoc blocks that should carry the `@param` tags
 * @param label   a human-readable identifier for the violation message
 * @param push    sink for any violation messages found
 */
function checkParams(
  node: ParameteredNode,
  jsDocs: ReturnType<JSDocableNode['getJsDocs']>,
  label: string,
  push: (message: string) => void,
): void {
  const params = node.getParameters();
  if (params.length === 0) return;
  const documented = documentedParams(jsDocs);
  for (const param of params) {
    const name = param.getName();
    if (!documented.has(name))
      push(`${label}: parameter \`${name}\` is not documented with @param`);
  }
}

describe('documentation conformance (CLAUDE.md doc rule)', () => {
  test('every exported symbol has a doc block; every exported function documents its @params', () => {
    const project = loadProject();
    const violations: string[] = [];
    const cwd = process.cwd().replace(/\\/g, '/');

    for (const sourceFile of project.getSourceFiles()) {
      const abs = sourceFile.getFilePath();
      if (EXCLUDE.test(abs)) continue;
      const rel = abs.replace(`${cwd}/`, '');
      const at = (line: number) => `${rel}:${line}`;
      const needsDoc = (node: JSDocableNode & Node, what: string) => {
        if (node.getJsDocs().length === 0) {
          violations.push(`${at(node.getStartLineNumber())} — ${what} has no doc block`);
        }
      };

      for (const fn of sourceFile.getFunctions()) {
        if (!fn.isExported()) continue;
        const name = `function ${fn.getName() ?? '(anonymous)'}`;
        needsDoc(fn, name);
        checkParams(fn, fn.getJsDocs(), at(fn.getStartLineNumber()) + ` ${name}`, (m) =>
          violations.push(m),
        );
      }
      for (const node of sourceFile.getInterfaces())
        if (node.isExported()) needsDoc(node, `interface ${node.getName()}`);
      for (const node of sourceFile.getTypeAliases())
        if (node.isExported()) needsDoc(node, `type ${node.getName()}`);
      for (const node of sourceFile.getClasses())
        if (node.isExported()) needsDoc(node, `class ${node.getName() ?? '(anonymous)'}`);
      for (const node of sourceFile.getEnums())
        if (node.isExported()) needsDoc(node, `enum ${node.getName()}`);

      for (const stmt of sourceFile.getVariableStatements()) {
        if (!stmt.isExported()) continue;
        const names = stmt
          .getDeclarations()
          .map((d) => d.getName())
          .join(', ');
        needsDoc(stmt, `const ${names}`);
        // An exported const initialised to an arrow/function is a function → its @params must be documented.
        for (const decl of stmt.getDeclarations()) {
          const init = decl.getInitializer();
          if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
            checkParams(
              init,
              stmt.getJsDocs(),
              `${at(stmt.getStartLineNumber())} const ${decl.getName()}`,
              (m) => violations.push(m),
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Documentation-conformance violations (${violations.length}):\n${violations.join('\n')}`,
      );
    }
    expect(violations.length).toBe(0);
  });
});
