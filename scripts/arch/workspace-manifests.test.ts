/**
 * Fitness function: every workspace package follows the module conventions from ADR 0003 §5
 * (@grimora-scoped name, private, ESM, a single public `src/index.ts` entry). Guarantees a
 * newly added module is covered by the harness's expectations from the moment it appears.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MODULE_DIRS } from "./cruise";

function workspacePackageDirs(): string[] {
  const dirs: string[] = [];
  for (const root of MODULE_DIRS) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const dir = join(root, name);
      if (statSync(dir).isDirectory() && existsSync(join(dir, "package.json"))) {
        dirs.push(dir);
      }
    }
  }
  return dirs;
}

describe("workspace manifest conventions (ADR 0003 §5)", () => {
  const dirs = workspacePackageDirs();

  test("at least one workspace package exists", () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  for (const dir of dirs) {
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

    describe(dir, () => {
      test("name is @grimora-scoped", () => {
        expect(typeof manifest.name).toBe("string");
        expect((manifest.name as string).startsWith("@grimora/")).toBe(true);
      });

      test("is private and an ES module", () => {
        expect(manifest.private).toBe(true);
        expect(manifest.type).toBe("module");
      });

      test("has a single public entry (src/index.ts)", () => {
        expect(existsSync(join(dir, "src", "index.ts"))).toBe(true);
      });
    });
  }
});
