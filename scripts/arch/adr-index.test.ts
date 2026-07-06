/**
 * Fitness function: the ADR index (`docs/adr/README.md`) stays in sync with the ADR files
 * — every ADR file is linked from the index, every index link resolves, and every ADR
 * declares a Status. Keeps the normative decision record from silently drifting (issue #9).
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ADR_DIR = "docs/adr";

function adrFiles(): string[] {
  return readdirSync(ADR_DIR)
    .filter((name) => /^\d{4}-.+\.md$/.test(name))
    .sort();
}

describe("ADR index conformance (docs/adr/README.md)", () => {
  const index = readFileSync(join(ADR_DIR, "README.md"), "utf8");
  const files = adrFiles();

  test("there is at least one ADR", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test("every ADR file is linked from the index", () => {
    for (const file of files) {
      expect(
        index.includes(`](${file})`),
        `ADR ${file} is not linked in ${ADR_DIR}/README.md`,
      ).toBe(true);
    }
  });

  test("every ADR link in the index resolves to an existing file", () => {
    const linked = [...index.matchAll(/\]\((\d{4}-[^)]+\.md)\)/g)].map((match) => match[1]);
    expect(linked.length).toBeGreaterThan(0);
    const present = new Set(files);
    for (const link of linked) {
      expect(present.has(link as string), `Index links ${link}, but that file does not exist`).toBe(
        true,
      );
    }
  });

  test("every ADR declares a Status", () => {
    for (const file of files) {
      const body = readFileSync(join(ADR_DIR, file), "utf8");
      expect(/\*\*Status:\*\*/.test(body), `ADR ${file} does not declare a **Status:**`).toBe(true);
    }
  });
});
