/**
 * Application-layer use-case tests (ADR 0017 §1): authorization (default-deny + owner-scoped) and the
 * success **and** failure paths for each command (ADR 0017 §4/R4 — guarded transitions get a
 * rejection-path test). Uses in-memory fakes + an inline minimal plugin (no dependency on dsa5).
 */

import { describe, expect, it } from "bun:test";
import { definePlugin, type GrimoraPlugin } from "@grimora/plugin-sdk";
import { type EntityId, ok } from "@grimora/shared-types";
import {
  createFixedClock,
  createInMemoryEventStore,
  createOwnerPolicy,
  createSequentialIdGenerator,
} from "../testing/fakes";
import { createPluginHost } from "./plugin-host";
import type { Actor } from "./ports";
import {
  type CommandDeps,
  createCampaign,
  createCharacter,
  rollCheck,
  setAttribute,
} from "./use-cases";

const testPlugin: GrimoraPlugin = definePlugin(
  { id: "test.rules", name: "Test", version: "1.0.0", sdkVersion: 0 },
  (registry) => {
    registry.registerRuleSystem({
      id: "test",
      labelKey: "test",
      traits: [{ kind: "attribute", id: "STR", labelKey: "str", min: 1, max: 10, defaultValue: 1 }],
      checks: [
        {
          id: "lift",
          labelKey: "lift",
          attributeIds: ["STR"],
          terms: [{ sides: 6, count: 1 }],
          resolve: (input) =>
            ok({ value: { die: input.rolls[0]?.[0] ?? 0 }, labelKey: "lift.done" }),
        },
      ],
    });
  },
);

function makeDeps(): CommandDeps {
  const host = createPluginHost();
  host.load(testPlugin);
  return {
    events: createInMemoryEventStore(),
    ids: createSequentialIdGenerator("t"),
    clock: createFixedClock(),
    policy: createOwnerPolicy(),
    rules: host,
  };
}

const owner: Actor = { userId: "owner" as EntityId };
const intruder: Actor = { userId: "intruder" as EntityId };
const campaignId = "c1" as EntityId;
const characterId = "ch1" as EntityId;

async function seedCharacter(deps: CommandDeps): Promise<void> {
  await createCampaign(deps, { campaignId, name: "C", actor: owner });
  await createCharacter(deps, {
    characterId,
    name: "Hero",
    campaignId,
    ruleSystemId: "test",
    actor: owner,
  });
}

describe("createCampaign", () => {
  it("creates for an authenticated actor and rejects an empty actor (default-deny)", async () => {
    const deps = makeDeps();
    expect((await createCampaign(deps, { campaignId, name: "C", actor: owner })).ok).toBe(true);
    const anon = await createCampaign(deps, {
      campaignId: "c2" as EntityId,
      name: "C",
      actor: { userId: "" as EntityId },
    });
    expect(anon.ok).toBe(false);
  });

  it("rejects a blank name (Validation)", async () => {
    const result = await createCampaign(makeDeps(), { campaignId, name: "   ", actor: owner });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe("Validation");
  });
});

describe("createCharacter", () => {
  it("requires the rule system to be loaded", async () => {
    const result = await createCharacter(makeDeps(), {
      characterId,
      name: "Hero",
      campaignId,
      ruleSystemId: "unloaded",
      actor: owner,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("character.rule_system_not_loaded");
  });
});

describe("setAttribute", () => {
  it("lets the owner set a valid value", async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    expect(
      (await setAttribute(deps, { characterId, attributeId: "STR", value: 5, actor: owner })).ok,
    ).toBe(true);
  });

  it("denies a non-owner (Forbidden — same PolicyPort the AI path reuses)", async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    const result = await setAttribute(deps, {
      characterId,
      attributeId: "STR",
      value: 5,
      actor: intruder,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe("Forbidden");
  });

  it("rejects an out-of-range value and an unknown attribute (Validation)", async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    const outOfRange = await setAttribute(deps, {
      characterId,
      attributeId: "STR",
      value: 99,
      actor: owner,
    });
    expect(outOfRange.ok).toBe(false);
    const unknown = await setAttribute(deps, {
      characterId,
      attributeId: "XXX",
      value: 3,
      actor: owner,
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe("character.unknown_attribute");
  });
});

describe("rollCheck", () => {
  it("lets the owner roll and denies a non-owner", async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    await setAttribute(deps, { characterId, attributeId: "STR", value: 5, actor: owner });
    expect((await rollCheck(deps, { characterId, checkId: "lift", actor: owner })).ok).toBe(true);
    const denied = await rollCheck(deps, { characterId, checkId: "lift", actor: intruder });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.category).toBe("Forbidden");
  });

  it("rejects an unknown check (NotFound)", async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    await setAttribute(deps, { characterId, attributeId: "STR", value: 5, actor: owner });
    const result = await rollCheck(deps, { characterId, checkId: "nope", actor: owner });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("character.unknown_check");
  });
});
