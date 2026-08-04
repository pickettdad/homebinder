/**
 * The pin's assistant thread (Stage 1 step 6). Recorded, not streamed — you ask, the
 * reply lands when it lands (desk-side that evening is the common case; on site is the
 * exception, per the owner). Works offline: the ask is queued and answered on reconnect.
 * The assistant identifies and defers; it never renders a verdict (enforced server-side).
 */
import { useState } from "react";
import { useApp } from "../../store/sessionStore";
import { BigButton } from "../../ui/bits";
import { getAppToken } from "../../chat/queue";

// Collapse is per-pin UI state, not inspection data — it lives in localStorage, never in the
// event log. Persisted so a thread the inspector deliberately folded away stays folded when
// they leave the pin and come back.
const collapseKey = (pinId: string) => `hs-chat-collapsed:${pinId}`;
function readCollapsed(pinId: string): boolean {
  try {
    return localStorage.getItem(collapseKey(pinId)) === "1";
  } catch {
    return false;
  }
}
function writeCollapsed(pinId: string, collapsed: boolean): void {
  try {
    if (collapsed) localStorage.setItem(collapseKey(pinId), "1");
    else localStorage.removeItem(collapseKey(pinId));
  } catch {
    /* private mode — collapse just won't persist */
  }
}

export function ChatPanel({ pinId, readOnly = false }: { pinId: string; readOnly?: boolean }) {
  const { v2Session, sendChatMessage, drainChatNow, showToast } = useApp();
  const [draft, setDraft] = useState("");
  const [withPhotos, setWithPhotos] = useState(true);
  const [sending, setSending] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readCollapsed(pinId));

  const pin = v2Session?.pins.find((p) => p.pinId === pinId);
  if (!v2Session || !pin) return null;
  const thread = [...v2Session.chats.values()].find((t) => t.target.kind === "pin" && t.target.id === pinId);
  const msgs = thread?.messages ?? [];
  const last = msgs[msgs.length - 1];
  const awaiting = !!last && last.role === "user" && !thread?.lastFailure;
  const tokenSet = !!getAppToken();
  const hasThread = msgs.length > 0;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(pinId, next);
  };

  // Header with an optional fold toggle (only once there's a conversation to fold).
  const header = (
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-semibold text-slate-300">Ask the assistant</h2>
      {hasThread && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          aria-expanded={!collapsed}
        >
          {msgs.length} message{msgs.length === 1 ? "" : "s"}
          {awaiting && " · thinking…"}
          {thread?.lastFailure && " · needs a retry"}
          <span aria-hidden>{collapsed ? "▸" : "▾"}</span>
        </button>
      )}
    </div>
  );

  // Folded away: keep only the header + one-line status. The thread stays fully recorded in
  // the log; nothing is lost, it's just off-screen so it stops eating the pin's real estate.
  if (hasThread && collapsed) {
    return (
      <section className="flex flex-col gap-2">
        {header}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded-xl border border-dashed border-slate-700 px-3 py-2 text-left text-sm text-slate-400 hover:border-slate-600"
        >
          Conversation collapsed — tap to reopen.
        </button>
      </section>
    );
  }

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    const mediaIds = withPhotos ? pin.photos.map((m) => m.mediaId) : [];
    void sendChatMessage({ kind: "pin", id: pinId }, text, mediaIds)
      .then(() => setDraft(""))
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not send"))
      .finally(() => setSending(false));
  };

  return (
    <section className="flex flex-col gap-2">
      {header}

      {msgs.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-400">
          A second set of eyes — read a nameplate, place equipment, or ask what else is worth a shot.
          It suggests; you decide.
        </p>
      )}

      {msgs.map((m, i) => (
        <div
          key={i}
          className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
            m.role === "user"
              ? "self-end bg-brass-900/50 text-brass-50"
              : "self-start bg-slate-800 text-slate-100"
          }`}
        >
          <p className="whitespace-pre-wrap">{m.text}</p>
          {m.role === "assistant" && (
            <p className="mt-1 text-xs text-slate-500">{m.model ?? "assistant"}</p>
          )}
        </div>
      ))}

      {awaiting && (
        <p className="self-start rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-400">
          {tokenSet ? "Thinking… (arrives when online; you can keep working)" : "Queued — set the assistant token to get a reply."}
        </p>
      )}

      {thread?.lastFailure && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-alert-950/50 p-3 text-sm text-alert-200">
          <span>Couldn't reach the assistant ({thread.lastFailure.code}).</span>
          {!readOnly && (
            <BigButton variant="secondary" onClick={() => void drainChatNow()}>Retry</BigButton>
          )}
        </div>
      )}

      {readOnly ? (
        <p className="text-xs text-slate-500">Reopen the inspection to ask more.</p>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about this pin (type or dictate)…"
            rows={2}
            className="rounded-xl bg-slate-800 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-brass-500"
          />
          <div className="flex items-center justify-between gap-2">
            {pin.photos.length > 0 ? (
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
                Include {pin.photos.length} photo{pin.photos.length === 1 ? "" : "s"}
              </label>
            ) : (
              <span className="text-xs text-slate-500">No photos on this pin yet</span>
            )}
            <BigButton variant="secondary" disabled={sending || !draft.trim()} onClick={send}>Ask</BigButton>
          </div>
          {!tokenSet && (
            <p className="text-xs text-slate-500">
              Replies need the assistant token (set it on the home screen). You can still ask — it answers once configured.
            </p>
          )}
        </>
      )}
    </section>
  );
}
