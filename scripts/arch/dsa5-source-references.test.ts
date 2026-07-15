/**
 * DSA5 source-reference fitness function (ADR 0029 §3/§5, decision R3): every talent in the DSA5
 * mechanical roster must carry a **usable** reference to the rule it implements.
 *
 * Why a harness check when `Talent.regelwiki` is already a *required* field: TypeScript enforces that the
 * property **exists**, not that it is worth anything. `regelwiki: ''`, `regelwiki: 'TODO'`, or the same URL
 * copy-pasted onto all 59 entries all type-check perfectly while destroying the very property ADR 0029
 * exists to guarantee — that a reviewer can open a rule and check the code against it. This is the same
 * gap `privacy-classification.test.ts` covers for event classifications: structural typing catches a
 * malformed entry, never a *vacuous* one.
 *
 * That matters here because the ADR was written in response to a real defect: `LP = 5 + COU + AGI` shipped
 * and passed review for weeks precisely because nothing could be checked against anything (#223). A
 * reference that points nowhere would restore exactly that state while looking compliant.
 *
 * ADR 0029 **R3** deliberately deferred this assertion until the reference set was complete (#222/PR #224)
 * so the gate could never be red mid-rollout. It is complete, so the gate closes here.
 *
 * Scope: the **talent catalog**, where references are structured data. Attributes, derived values and the
 * check mechanic carry theirs in doc comments (they derive frozen SDK types that cannot hold a
 * DSA-specific field, ADR 0029 §3), which is prose — deliberately left to review, not asserted here.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Node, type ObjectLiteralExpression, Project, type SourceFile } from 'ts-morph';

const TALENTS_DIR = 'plugins/dsa5/src/talents';

/** Modules in the talents directory that hold no roster entries (the model, the barrel, tests). */
const NON_ROSTER_FILES = new Set(['index.ts', 'types.ts']);

/**
 * The official Ulisses Regel-Wiki hosts — the only references the content boundary permits us to cite
 * (German + English *The Dark Eye*). Anything else (a fan wiki, a blog, a placeholder) is not an
 * authority and must not pass as one.
 */
const OFFICIAL_WIKI_HOSTS = ['dsa.ulisses-regelwiki.de', 'tde.ulisses-regelwiki.de'];

/** One roster entry's source references, as written in the catalog. */
interface TalentReference {
  /** the talent's stable id, used to name the entry in failure output */
  readonly id: string;
  /** the public Regel-Wiki reference, or undefined if the property is absent */
  readonly regelwiki: string | undefined;
  /** the private vault-note path, or undefined (the field is optional per ADR 0029 R2) */
  readonly vaultNote: string | undefined;
}

/**
 * Read a string-literal property off an object literal.
 * @param object  the object literal to read from
 * @param name    the property name
 * @returns       the string value, or undefined if absent or not a plain string literal
 */
function stringProp(object: ObjectLiteralExpression, name: string): string | undefined {
  const prop = object.getProperty(name);
  if (!prop || !Node.isPropertyAssignment(prop)) return undefined;
  const init = prop.getInitializer();
  return init && Node.isStringLiteral(init) ? init.getLiteralValue() : undefined;
}

/**
 * Every roster entry declared in a talent-group module, found via the exported `*_TALENTS` array.
 * Derived from the array rather than a hardcoded list so a **new** talent group file is covered the
 * moment it exists — a check that must be remembered is the kind that erodes.
 * @param sourceFile  the ts-morph source file to scan
 * @returns           one {@link TalentReference} per entry in the file
 */
function talentReferences(sourceFile: SourceFile): TalentReference[] {
  const found: TalentReference[] = [];
  for (const decl of sourceFile.getVariableDeclarations()) {
    if (!decl.getName().endsWith('_TALENTS')) continue;
    const init = decl.getInitializer();
    if (!init || !Node.isArrayLiteralExpression(init)) continue;
    for (const element of init.getElements()) {
      if (!Node.isObjectLiteralExpression(element)) continue;
      found.push({
        id: stringProp(element, 'id') ?? '(unnamed entry)',
        regelwiki: stringProp(element, 'regelwiki'),
        vaultNote: stringProp(element, 'vaultNote'),
      });
    }
  }
  return found;
}

/**
 * Collect every talent reference across the catalog's group modules.
 * @param dir  the talents directory to scan
 * @returns    every roster entry found, across all group files
 */
function catalogReferences(dir: string): TalentReference[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  const files = readdirSync(dir).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !NON_ROSTER_FILES.has(f),
  );
  return files.flatMap((f) => talentReferences(project.addSourceFileAtPath(join(dir, f))));
}

/**
 * The reasons a reference fails to be an authority, as human-readable problems.
 * @param entries  the roster entries to validate
 * @returns        one message per problem found (empty when the catalog is sound)
 */
function referenceProblems(entries: readonly TalentReference[]): string[] {
  const problems: string[] = [];
  const seenWiki = new Map<string, string>();
  const seenNote = new Map<string, string>();

  for (const entry of entries) {
    const url = entry.regelwiki;
    // `=== undefined`, not falsy: an empty string is *present but worthless*, which is a different (and
    // more likely) failure than an absent property — and the message should say which.
    if (url === undefined) {
      problems.push(`${entry.id}: no regelwiki reference`);
    } else if (!OFFICIAL_WIKI_HOSTS.some((host) => url.includes(host))) {
      // Catches '' and placeholders like 'TODO' too — neither contains an official host.
      problems.push(`${entry.id}: regelwiki is not an official Regel-Wiki URL (${url || 'empty'})`);
    } else {
      const twin = seenWiki.get(url);
      if (twin) problems.push(`${entry.id}: shares its regelwiki URL with ${twin} (copy-paste?)`);
      else seenWiki.set(url, entry.id);
    }

    // vaultNote is optional (ADR 0029 R2) — but a present one must be a real vault rules-area note.
    const note = entry.vaultNote;
    if (note !== undefined) {
      if (!note.startsWith('01 Regeln/') || !note.endsWith('.md')) {
        problems.push(`${entry.id}: vaultNote is not a vault rules note (${note || 'empty'})`);
      } else {
        const twin = seenNote.get(note);
        if (twin) problems.push(`${entry.id}: shares its vaultNote with ${twin} (copy-paste?)`);
        else seenNote.set(note, entry.id);
      }
    }
  }
  return problems;
}

describe('DSA5 source references (ADR 0029 R3)', () => {
  test('every catalog talent cites a distinct, official rule source', () => {
    const entries = catalogReferences(TALENTS_DIR);

    // Guards against a vacuous pass: if the scan ever stops finding entries (a rename, a restructure),
    // "no problems" would otherwise look like success while checking nothing at all.
    expect(entries.length).toBeGreaterThan(50);

    const problems = referenceProblems(entries);
    if (problems.length > 0) {
      throw new Error(
        `DSA5 talents must each cite the rule they implement (ADR 0029 §2):\n  ${problems.join('\n  ')}`,
      );
    }
    expect(problems).toEqual([]);
  });

  test('the scan catches an empty, unofficial or copy-pasted reference (self-test)', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      useInMemoryFileSystem: true,
    });
    const sourceFile = project.createSourceFile(
      '/bogus.ts',
      [
        'export const BOGUS_TALENTS = [',
        // Type-correct in every case below — which is the whole point of asserting it here.
        "  { id: 'EMPTY', regelwiki: '' },",
        "  { id: 'FAN_WIKI', regelwiki: 'https://example.com/wiki/Klettern' },",
        "  { id: 'REAL', regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Klettern' },",
        "  { id: 'PASTED', regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Klettern' },",
        "  { id: 'BAD_NOTE', regelwiki: 'https://tde.ulisses-regelwiki.de/x', vaultNote: 'notes.md' },",
        '];',
      ].join('\n'),
    );

    const problems = referenceProblems(talentReferences(sourceFile));

    expect(problems).toEqual([
      'EMPTY: regelwiki is not an official Regel-Wiki URL (empty)',
      'FAN_WIKI: regelwiki is not an official Regel-Wiki URL (https://example.com/wiki/Klettern)',
      'PASTED: shares its regelwiki URL with REAL (copy-paste?)',
      'BAD_NOTE: vaultNote is not a vault rules note (notes.md)',
    ]);
  });
});
