import { describe, expect, it } from "vitest";
import {
  CHILD_SAFETY_DECLINE,
  checkChildSafety,
  MODERATION_DECLINE,
  moderateMessage,
} from "./moderation";

// These lock the *contracts*, not the model: the child-safety seam is inert
// until a detector is wired, and the toxicity pre-check fails open. No network.

describe("checkChildSafety (inert seam)", () => {
  it("never flags today — no detector is wired", async () => {
    for (const text of ["", "hello", "anything at all", "x".repeat(3000)]) {
      const result = await checkChildSafety(text);
      expect(result.flagged).toBe(false);
    }
  });
});

describe("moderateMessage (fails open)", () => {
  it("returns SAFE on empty input without calling out", async () => {
    expect(await moderateMessage("")).toEqual({
      flagged: false,
      label: null,
      score: 0,
    });
  });

  it("returns SAFE when no HF_TOKEN is configured (fail open)", async () => {
    const prev = process.env.HF_TOKEN;
    // Empty string is falsy, which is the "no token" branch moderateMessage
    // guards on — no need to remove the key (and no risk of "undefined" coercion).
    process.env.HF_TOKEN = "";
    try {
      const result = await moderateMessage("some message");
      expect(result.flagged).toBe(false);
    } finally {
      process.env.HF_TOKEN = prev ?? "";
    }
  });
});

describe("decline copy", () => {
  it("toxicity decline invites a rephrase; child-safety decline does not", () => {
    expect(MODERATION_DECLINE.toLowerCase()).toContain("rephrase");
    expect(CHILD_SAFETY_DECLINE.toLowerCase()).not.toContain("rephrase");
    expect(CHILD_SAFETY_DECLINE.length).toBeGreaterThan(0);
  });
});
