import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ANTIGRAVITY_CHECKPOINT_ERROR,
  ANTIGRAVITY_IDLE_MS,
  ANTIGRAVITY_NEW_AT,
  antigravityAffinityForDispatch,
  antigravityCloseStateForTests,
  antigravityNoteAssistantText,
  antigravityNoteObserved,
  antigravityNoteUsage,
  antigravityPromptText,
  antigravityRecentRecovery,
  antigravityResumeDecision,
  noteTelegramThread,
} from "./antigravity-session.ts";

let directory = "";
let statePath = "";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "omb-antigravity-session-"));
  statePath = join(directory, "antigravity-sessions.json");
  process.env.OMB_ANTIGRAVITY_STATE_PATH = statePath;
  antigravityCloseStateForTests();
});

afterEach(() => {
  antigravityCloseStateForTests();
  delete process.env.OMB_ANTIGRAVITY_STATE_PATH;
  rmSync(directory, { recursive: true, force: true });
});

describe("antigravity sticky session", () => {
  it("resumes until a measurement, an idle gap, a checkpoint, or a new-session command", () => {
    expect(antigravityResumeDecision({ threadId: "t" })).toEqual({ resume: true, reason: "no measurement yet" });
    antigravityNoteUsage("t", 1000);
    expect(antigravityResumeDecision({
      threadId: "t",
      antigravityAffinity: { inputTokens: 1000, gapMs: 30_000 },
    })).toEqual({ resume: true, reason: "active 30s" });
    expect(antigravityResumeDecision({
      threadId: "t",
      antigravityAffinity: { inputTokens: ANTIGRAVITY_NEW_AT, gapMs: 1000 },
    }).resume).toBe(false);
    expect(antigravityResumeDecision({
      threadId: "t",
      antigravityAffinity: { inputTokens: 1000, gapMs: ANTIGRAVITY_IDLE_MS },
    })).toEqual({ resume: false, reason: "idle 20min" });
    expect(antigravityResumeDecision({
      threadId: "t",
      antigravityAffinity: { forceNew: true, inputTokens: 10 },
    })).toEqual({ resume: false, reason: "command" });
  });

  it("treats observed text as tokens and remembers a poisoned checkpoint across a reload", () => {
    antigravityNoteObserved("t", ANTIGRAVITY_NEW_AT * 4);
    antigravityCloseStateForTests();
    expect(antigravityResumeDecision({ threadId: "t", antigravityAffinity: { inputTokens: 0 } }).resume).toBe(false);
    antigravityNoteUsage("t", 0);
    antigravityNoteAssistantText("t", `Agent execution error: ${ANTIGRAVITY_CHECKPOINT_ERROR}`, "");
    antigravityCloseStateForTests();
    expect(antigravityResumeDecision({ threadId: "t", antigravityAffinity: { inputTokens: 10 } })).toEqual({
      resume: false,
      reason: "checkpoint",
    });
    const saved = JSON.parse(readFileSync(statePath, "utf8"));
    expect(saved.t.poisoned).toBe(true);
    expect(statePath.startsWith(directory)).toBe(true);
  });

  it("keeps the latest 20 replay turns on a fresh session and sends only the new line when resuming", () => {
    const history = ["preamble"];
    for (let i = 1; i <= 25; i += 1) history.push(`User: line ${i}`);
    const recovery = `${history.join("\n")}\n[Now reply to the user's latest message:]\nUser: latest`;
    const trimmed = antigravityRecentRecovery(recovery);
    expect(trimmed).not.toContain("User: line 5\n");
    expect(trimmed).toContain("User: line 6");
    expect(trimmed).toContain("User: line 25");
    expect(antigravityPromptText(
      { text: "latest", system: "You are Moriss.", recoveryText: recovery },
      { resumed: false, replay: true },
    )).toMatch(/^You are Moriss\.\n\npreamble\n/);
    expect(antigravityPromptText(
      { text: "latest", system: "You are Moriss.", recoveryText: recovery },
      { resumed: true, replay: false },
    )).toBe("latest");
  });

  it("marks a Telegram thread and a /new command on the dispatch hint", () => {
    noteTelegramThread("tg");
    const hint = antigravityAffinityForDispatch({
      threadId: "tg",
      userText: "/new please",
      messages: [
        { id: "a", at: 1_000 },
        { id: "b", at: 1_000 + ANTIGRAVITY_IDLE_MS },
      ],
      userMessageId: "b",
      userMessageAt: 1_000 + ANTIGRAVITY_IDLE_MS,
      commsDepth: 0,
      peerAsk: false,
      fromBot: false,
      coordination: false,
      cardContinuation: false,
      contextTokens: 10,
      lastTurnInput: 4,
    });
    expect(hint).toMatchObject({ telegram: true, forceNew: true, gapMs: ANTIGRAVITY_IDLE_MS, inputTokens: 10 });
    expect(antigravityResumeDecision({ threadId: "tg", antigravityAffinity: { ...hint, forceNew: false } })).toEqual({
      resume: false,
      reason: "idle 20min",
    });
    expect(antigravityResumeDecision({
      threadId: "tg",
      antigravityAffinity: { telegram: true, gapMs: 1000, inputTokens: 10 },
    })).toEqual({ resume: true, reason: "telegram" });
  });
});
