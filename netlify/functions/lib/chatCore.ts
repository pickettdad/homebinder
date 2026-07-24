/**
 * Server-side chat doctrine + context assembly (pure, unit-tested). The in-product AI is
 * the money feature (owner: "the best working option there") — but it identifies and
 * defers, exactly like the review reviewer: it never renders verdicts. The word-lint is
 * the enforcement backstop on top of the prompt.
 */
import type { ChatScope } from "../../../src/chat/protocol";

const BANNED_PATTERNS = [
  /\bverified\b/i,
  /\bdefect(?:s|ive)?\b/i,
  /\bhazard(?:ous)?\b/i,
  /\bcode violation\b/i,
  /\bunsafe\b/i,
  /\bdefinitely\b/i,
  /\bfail(?:s|ed|ure)?\b/i,
];

const REFERRAL_NOTE =
  "\n\n(This is an observation to help you decide on site — not a verdict. Confirm it yourself, and refer anything safety-related to a licensed trade.)";

/**
 * Reply post-filter: if the model slipped a verdict word past the prompt, append the
 * standing referral note rather than ship a bare judgment. Idempotent — one note only.
 */
export function lintReply(text: string): { text: string; flagged: boolean } {
  const flagged = BANNED_PATTERNS.some((p) => p.test(text));
  if (!flagged || text.includes(REFERRAL_NOTE.trim())) return { text, flagged };
  return { text: text + REFERRAL_NOTE, flagged: true };
}

export function buildChatSystemPrompt(): string {
  return [
    "You are the field assistant inside a home-inspection capture app. An inspector is",
    "asking you about a specific component or room they've photographed — often at the desk",
    "in the evening while working through the day's pins, sometimes live on site.",
    "",
    "DOCTRINE (non-negotiable):",
    "- You IDENTIFY and explain; the human inspector decides. Never render verdicts,",
    "  assessments, pass/fail judgments, or safety determinations.",
    "- Help them read a nameplate, place equipment in its system, spot what else is worth",
    "  photographing, and recall what a component is. Answer from what the photos and",
    "  context actually show; if you can't tell, say so and suggest the capture that would.",
    "- For anything safety-adjacent (electrical, gas, combustion, structural), use referral",
    "  phrasing: 'Photo may show [observation]. If concerned, note it for evaluation by a",
    "  licensed [trade].' Never use the words: verified, defect, hazard, code violation,",
    "  definitely, fail, unsafe.",
    "",
    "Be concise and practical — the inspector is mid-workflow. Plain prose, no preamble.",
    "When suggesting more evidence, phrase it as a question ('worth a shot of the data",
    "plate before you leave?'). You are a second set of eyes, not the authority.",
  ].join("\n");
}

/** Turn the scope snapshot into a short context line the model reads before the thread. */
export function buildScopeContext(scope: ChatScope): string {
  if (scope.kind === "pin") {
    const bits = [
      `Pin #${scope.pinNumber}`,
      scope.pinType ? `type: ${scope.pinType}` : "type: not yet set",
      scope.label ? `nickname: ${scope.label}` : null,
      scope.flag ? `flag: ${scope.flag}` : null,
      scope.zoneLabel ? `in ${scope.zoneLabel}${scope.zoneType ? ` (${scope.zoneType})` : ""}` : null,
    ].filter(Boolean);
    const notes = scope.notes.length ? `\nInspector notes: ${scope.notes.join(" | ")}` : "";
    return `Context — ${bits.join(", ")}.${notes}`;
  }
  const pins = scope.pinIndex
    .map((p) => `#${p.number} ${p.type ?? "untyped"}${p.flag ? ` [${p.flag}]` : ""}`)
    .join(", ");
  return `Context — ${scope.zoneLabel} (${scope.zoneType}). Pins: ${pins || "none yet"}.`;
}
