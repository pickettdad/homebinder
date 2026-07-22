/**
 * Pure server-side review logic — no I/O, unit-tested from the main suite.
 * The function wrapper (../review.mts) handles HTTP, auth, and the Anthropic call.
 */
import type { WireFinding, ZoneSummaryRequest } from "../../../src/review/protocol";

/**
 * Doctrine lint: findings must identify, never adjudicate. Verdict-language findings
 * are downgraded to info with neutral wording rather than shipped — the model is
 * prompted not to produce these, and this is the enforcement backstop.
 */
const BANNED_PATTERNS = [
  /\bverified\b/i,
  /\bdefect(?:s|ive)?\b/i,
  /\bhazard(?:s|ous)?\b/i,
  /\bcode\s+violation\b/i,
  /\bdefinitely\b/i,
  /\bfail(?:s|ed)?\b/i,
  /\bunsafe\b/i,
  /\billegal\b/i,
];

export function lintFinding(finding: WireFinding): { finding: WireFinding; downgraded: boolean } {
  const banned = BANNED_PATTERNS.some((p) => p.test(finding.message));
  if (!banned) return { finding, downgraded: false };
  return {
    downgraded: true,
    finding: {
      ...finding,
      severity: "info",
      message: "Flagged for inspector review — see the photo and use your own judgment.",
    },
  };
}

/**
 * Model output discipline: findings referencing ids not in the request are dropped —
 * a hallucinated slot must never reach the client's event log.
 */
export function validateFindings(
  raw: unknown,
  request: Pick<ZoneSummaryRequest, "slots" | "images"> & { job: { jobId: string } },
): WireFinding[] {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { findings?: unknown }).findings)) return [];
  const slotIds = new Set(request.slots.map((s) => s.slotInstanceId));
  const mediaIds = new Set(request.images.map((i) => i.mediaId));
  const out: WireFinding[] = [];
  let index = 0;
  for (const item of (raw as { findings: unknown[] }).findings) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const slotInstanceId = typeof f.slotInstanceId === "string" ? f.slotInstanceId : "";
    if (!slotIds.has(slotInstanceId)) continue;
    const severity = f.severity === "reshoot" || f.severity === "anomaly" ? f.severity : "info";
    const message = typeof f.message === "string" ? f.message.slice(0, 500) : "";
    if (!message) continue;
    const refs = Array.isArray(f.mediaIds) ? f.mediaIds.filter((m): m is string => typeof m === "string" && mediaIds.has(m)) : [];
    const confidence = typeof f.confidence === "number" && f.confidence >= 0 && f.confidence <= 1 ? f.confidence : 0.5;
    out.push({
      // Deterministic id: replays and duplicate deliveries mint identical ids.
      findingId: `${request.job.jobId}-${index}`,
      slotInstanceId,
      mediaIds: refs,
      severity,
      message,
      confidence,
    });
    index += 1;
  }
  return out.map((f) => lintFinding(f).finding);
}

export function buildSystemPrompt(): string {
  return [
    "You are the 'Second look' reviewer inside a home-inspection capture app. The inspector",
    "has just closed a zone; you review that zone's photos as a batch.",
    "",
    "DOCTRINE (non-negotiable):",
    "- You IDENTIFY; the human inspector decides. Never render verdicts, assessments,",
    "  pass/fail judgments, or safety determinations.",
    "- Findings are suggestions, phrased as observations. Anomaly findings must end in an",
    "  action suggestion phrased as a question (e.g. 'worth a moisture reading before you leave?').",
    "- For anything safety-adjacent (electrical, gas, combustion, structural), use referral",
    "  phrasing: 'Photo may show [observation]. If concerned, note for evaluation by a",
    "  licensed [trade].' Never use the words: verified, defect, hazard, code violation,",
    "  definitely, fail, unsafe.",
    "",
    "Produce three kinds of findings:",
    "1. severity 'reshoot' — a photo is unusable for its slot's purpose: glare or blur over",
    "   label text, wrong subject for the slot, too dark, subject cut off. Say what to fix.",
    "2. severity 'anomaly' — something in a photo worth capturing MORE evidence about",
    "   before leaving: possible moisture staining, efflorescence, corrosion at fittings,",
    "   scorching, active drips. Only flag what is visible; suggest the extra capture.",
    "3. severity 'info' — the photo set for a slot looks consistent with the slot's label.",
    "   At most ONE info finding summarizing consistency; do not emit per-photo praise.",
    "",
    "Judge each SLOT as a set: if any one photo for a slot serves the purpose, do not",
    "request a reshoot for the weaker frames.",
    "",
    "Respond with ONLY a JSON object: {\"findings\": [{\"slotInstanceId\": string,",
    "\"mediaIds\": string[], \"severity\": \"info\"|\"reshoot\"|\"anomaly\", \"message\": string,",
    "\"confidence\": number 0-1}]}. No prose outside the JSON.",
  ].join("\n");
}

export function buildUserContext(request: ZoneSummaryRequest): string {
  return JSON.stringify({
    zone: request.zone,
    slots: request.slots,
    imageIndex: request.images.map((im, i) => ({
      position: i + 1,
      mediaId: im.mediaId,
      slotInstanceId: im.slotInstanceId,
    })),
  });
}

/** Extract the first JSON object from model text (tolerates code fences). */
export function parseModelJson(text: string): unknown | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}
