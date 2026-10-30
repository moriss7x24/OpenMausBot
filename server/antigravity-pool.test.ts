import { describe, expect, it } from "vitest";

import { antigravityAccountBlocked, antigravitySiblingKeepsModel, pickAntigravityAccount } from "./antigravity-pool.ts";

const accounts = [
  { instanceId: "antigravity", authenticated: true },
  { instanceId: "antigravity-b", authenticated: true },
  { instanceId: "antigravity-c", authenticated: false },
];

describe("antigravity account pool", () => {
  it("keeps a thread on the account that can still resume", () => {
    expect(pickAntigravityAccount({
      accounts,
      preferredId: "antigravity-b",
      preferredCanResume: true,
      now: 10,
      memory: { cooldownUntil: new Map(), lastAssignedAt: new Map([["antigravity", 1]]) },
    })).toEqual({ instanceId: "antigravity-b", reason: "sticky" });
  });

  it("spreads new work to the least recently used signed-in account", () => {
    expect(pickAntigravityAccount({
      accounts,
      preferredId: "antigravity",
      preferredCanResume: false,
      now: 10,
      memory: { cooldownUntil: new Map(), lastAssignedAt: new Map([["antigravity", 5], ["antigravity-b", 1]]) },
    })).toEqual({ instanceId: "antigravity-b", reason: "spread" });
  });

  it("skips an account that is cooling down or already failed this turn", () => {
    expect(pickAntigravityAccount({
      accounts,
      preferredId: "antigravity",
      preferredCanResume: true,
      exclude: new Set(["antigravity-b"]),
      now: 10,
      memory: { cooldownUntil: new Map([["antigravity", 50]]), lastAssignedAt: new Map() },
    })).toBeNull();
    expect(pickAntigravityAccount({
      accounts,
      preferredId: "antigravity",
      preferredCanResume: true,
      now: 10,
      memory: { cooldownUntil: new Map([["antigravity", 50]]), lastAssignedAt: new Map() },
    })).toEqual({ instanceId: "antigravity-b", reason: "spread" });
  });

  it("treats quota, rate limits, and signed-out profiles as a reason to switch", () => {
    expect(antigravityAccountBlocked(new Error("quota exceeded for this plan"))).toBe(true);
    expect(antigravityAccountBlocked(new Error("HTTP 429: Too Many Requests"))).toBe(true);
    expect(antigravityAccountBlocked(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
    expect(antigravityAccountBlocked(new Error("not logged in"))).toBe(true);
    expect(antigravityAccountBlocked(new Error("tool failed"))).toBe(false);
  });

  it("keeps the selected model when another signed-in account runs the turn", () => {
    expect(antigravitySiblingKeepsModel({
      routedKind: "antigravityAgent",
      selectedKind: "antigravityAgent",
      model: "gemini-3.8-flash-high",
      optionIds: ["gemini-3.8-flash-high"],
      fallback: "gemini-3.5-flash",
    })).toBe(true);
    expect(antigravitySiblingKeepsModel({
      routedKind: "antigravityAgent",
      selectedKind: "claudeAgent",
      model: "gemini-3.8-flash-high",
      optionIds: ["gemini-3.8-flash-high"],
      fallback: "gemini-3.8-flash-high",
    })).toBe(false);
  });
});
