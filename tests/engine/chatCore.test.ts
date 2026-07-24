import { describe, expect, it } from "vitest";
import { buildChatSystemPrompt, buildScopeContext, lintReply } from "../../netlify/functions/lib/chatCore";

describe("chat doctrine core", () => {
  it("lintReply appends a referral note only when a verdict word slips through — idempotently", () => {
    const clean = lintReply("This looks like a gas water heater — worth a shot of the data plate?");
    expect(clean.flagged).toBe(false);
    expect(clean.text).not.toMatch(/not a verdict/);

    const dirty = lintReply("This is definitely a code violation.");
    expect(dirty.flagged).toBe(true);
    expect(dirty.text).toMatch(/not a verdict/);
    // Re-linting an already-noted reply doesn't double-append.
    expect(lintReply(dirty.text).text).toBe(dirty.text);
  });

  it("system prompt carries the identify-never-adjudicate doctrine", () => {
    const p = buildChatSystemPrompt();
    expect(p).toMatch(/IDENTIFY/);
    expect(p).toMatch(/Never render verdicts/i);
    expect(p).toMatch(/licensed \[trade\]/);
  });

  it("buildScopeContext summarizes pin and zone scope", () => {
    const pinCtx = buildScopeContext({
      kind: "pin", pinNumber: 3, pinType: "water-heater", label: "main tank",
      flag: "monitor", zoneLabel: "Utility", zoneType: "utility", notes: ["TPR looks new"],
    });
    expect(pinCtx).toContain("#3");
    expect(pinCtx).toContain("water-heater");
    expect(pinCtx).toContain("main tank");
    expect(pinCtx).toContain("TPR looks new");

    const zoneCtx = buildScopeContext({
      kind: "zone", zoneLabel: "Utility", zoneType: "utility",
      pinIndex: [{ number: 1, type: "water-heater", flag: null }],
    });
    expect(zoneCtx).toContain("Utility");
    expect(zoneCtx).toContain("#1");
  });
});
