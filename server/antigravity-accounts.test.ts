import { describe, expect, it } from "vitest";

import { createAntigravityAccountSchema, newAntigravityAccount } from "./antigravity-accounts.ts";

describe("named Antigravity accounts", () => {
  it("adds an independent instance without dropping the default fleet", () => {
    const first = newAntigravityAccount({}, { displayName: "Work" });
    const second = newAntigravityAccount({ instances: first.instances }, { displayName: "Personal" });
    expect(first.instanceId).toMatch(/^antigravity-/);
    expect(first.instanceId).not.toBe(second.instanceId);
    expect(first.instances.antigravity).toMatchObject({ driver: "antigravityAgent" });
    expect(first.instances.claude).toBeDefined();
    expect(second.instances[first.instanceId]).toEqual({ driver: "antigravityAgent", displayName: "Work" });
    expect(second.instances[second.instanceId]).toEqual({ driver: "antigravityAgent", displayName: "Personal" });
    expect(first.instances[first.instanceId]?.config).toBeUndefined();
    expect(createAntigravityAccountSchema.safeParse({ displayName: " ", configDir: "/tmp" }).success).toBe(false);
  });
});