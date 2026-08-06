/**
 * Step-6 chat through the store: ask (recorded offline-safe) → drain applies the reply
 * with AI provenance, idempotently; a non-retryable failure records ChatFailed.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useApp } from "../../src/store/sessionStore";
import { loadChecklists } from "../../src/config/loadChecklists";
import { db } from "../../src/storage/db";
import { setAppToken } from "../../src/chat/queue";

const s = () => useApp.getState();
const threadFor = (pinId: string) =>
  [...s().v2Session!.chats.values()].find((t) => t.target.id === pinId)!;

async function settleChat() {
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await s().drainChatNow();
    const jobs = await db.chatJobs.toArray();
    if (jobs.length > 0 && jobs.every((j) => j.status === "done" || j.status === "failed")) {
      // Job terminal ⟹ its event is already committed (apply is atomic; failure records
      // the event before flipping status). One more drain to refold that event into the store.
      await s().drainChatNow();
      return;
    }
  }
}

beforeEach(async () => {
  const mem = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  });
  // Mimic Node's global navigator: present, but WITHOUT `onLine` (undefined) — the CI
  // condition that must NOT be read as "offline" by the drain's guard.
  vi.stubGlobal("navigator", { userAgent: "node-test" });
  await Promise.all([
    db.sessions.clear(), db.configSnapshots.clear(), db.events.clear(),
    db.media.clear(), db.outbox.clear(), db.chatJobs.clear(),
  ]);
  useApp.setState({
    sessionId: null, v2Config: null, v2Session: null, v2Events: [],
    checklists: loadChecklists(), checklistErrors: [], sessionRows: [],
    screen: { name: "home" },
  });
});

describe("v2 chat through the store", () => {
  it("ask is recorded even before a reply; drain applies the reply with AI provenance, idempotently", async () => {
    setAppToken("tok");
    await s().startSessionV2({ propertyFlags: ["gas"], visitKind: "discovery" });
    const utl = await s().createZone("utility", "Utility", {});
    const pin = await s().createPin(utl);
    await s().setPinType(pin, { kind: "component", componentType: "water-heater" });

    let seenScope: unknown;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      seenScope = body.scope;
      return {
        ok: true,
        json: async () => ({
          apiVersion: 1, kind: "chat", jobId: body.job.jobId, model: "claude-sonnet-5",
          text: "Looks like a gas water heater — worth a shot of the data plate?",
          usage: { inputTokens: 10, outputTokens: 8 },
        }),
      };
    }));

    await s().sendChatMessage({ kind: "pin", id: pin }, "what is this?", []);
    // The ask lands in the log immediately (offline-safe), before any network reply.
    expect(threadFor(pin).messages[0]).toMatchObject({ role: "user", text: "what is this?" });

    await settleChat();

    const msgs = threadFor(pin).messages;
    const reply = msgs[msgs.length - 1]!;
    expect(reply.role).toBe("assistant");
    expect(reply.text).toContain("water heater");
    expect(reply.model).toBe("claude-sonnet-5");
    expect(reply.source.actor).toBe("ai"); // provenance is the model, not the human

    // Full provenance chain — these are exactly the fields the export manifest's chats[]
    // section (PLAN-STAGE-1 §7) serializes per message: question + answer, each with its own
    // Source, and the model id stamped on the reply. Verified end-to-end from a live-ish
    // session (start → pin → ask → drained reply), not asserted against the spec.
    const question = msgs[0]!;
    expect(question).toMatchObject({ role: "user", text: "what is this?" });
    expect(question.source.actor).toBe("human"); // the ask is the inspector's
    expect(reply.source.actorId).toBe("claude-sonnet-5"); // actorId IS the model id (join key for provenance)
    // The scope snapshot reached the server.
    expect(seenScope).toMatchObject({ kind: "pin", pinNumber: 1, pinType: "water-heater" });

    // Idempotent: draining again doesn't append a second reply.
    await s().drainChatNow();
    expect(threadFor(pin).messages.filter((m) => m.role === "assistant")).toHaveLength(1);
    expect((await db.chatJobs.toArray())[0]?.status).toBe("done");
  });

  it("a non-retryable failure records ChatFailed on the thread", async () => {
    setAppToken("tok");
    await s().startSessionV2({ propertyFlags: [], visitKind: "discovery" });
    const utl = await s().createZone("utility", "Utility", {});
    const pin = await s().createPin(utl);

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: "auth", retryable: false, message: "bad token" } }),
    })));

    await s().sendChatMessage({ kind: "pin", id: pin }, "hello?", []);
    await settleChat();

    expect(threadFor(pin).lastFailure?.code).toBe("auth");
    expect((await db.chatJobs.toArray())[0]?.status).toBe("failed");
  });

  it("a 2xx non-JSON response (wrong origin / SPA fallback) fails fast as 'misrouted', not forever", async () => {
    setAppToken("tok");
    await s().startSessionV2({ propertyFlags: [], visitKind: "discovery" });
    const utl = await s().createZone("utility", "Utility", {});
    const pin = await s().createPin(utl);

    // The native-shell bug shape: API_BASE points at the wrong origin, so the request lands on
    // the SPA/index.html (200, not our JSON) instead of the function. Must surface immediately
    // (non-retryable) rather than back off into an endless "Thinking…".
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => null })));

    await s().sendChatMessage({ kind: "pin", id: pin }, "hello?", []);
    await settleChat();

    expect(threadFor(pin).lastFailure?.code).toBe("misrouted");
    expect((await db.chatJobs.toArray())[0]?.status).toBe("failed");
  });
});
