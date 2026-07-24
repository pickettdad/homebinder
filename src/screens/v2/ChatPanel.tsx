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

export function ChatPanel({ pinId, readOnly = false }: { pinId: string; readOnly?: boolean }) {
  const { v2Session, sendChatMessage, drainChatNow, showToast } = useApp();
  const [draft, setDraft] = useState("");
  const [withPhotos, setWithPhotos] = useState(true);
  const [sending, setSending] = useState(false);

  const pin = v2Session?.pins.find((p) => p.pinId === pinId);
  if (!v2Session || !pin) return null;
  const thread = [...v2Session.chats.values()].find((t) => t.target.kind === "pin" && t.target.id === pinId);
  const msgs = thread?.messages ?? [];
  const last = msgs[msgs.length - 1];
  const awaiting = !!last && last.role === "user" && !thread?.lastFailure;
  const tokenSet = !!getAppToken();

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
      <h2 className="font-semibold text-slate-300">Ask the assistant</h2>

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
              ? "self-end bg-teal-900/50 text-teal-50"
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
        <div className="flex items-center justify-between gap-2 rounded-xl bg-rose-950/50 p-3 text-sm text-rose-200">
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
            className="rounded-xl bg-slate-800 p-3 text-slate-100 outline-none ring-1 ring-slate-600 focus:ring-teal-500"
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
