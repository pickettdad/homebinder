/**
 * The wire contract between the PWA and the on-demand chat function (Stage 1 step 6).
 * Shared by client and server; versioned independently of the checklist config.
 *
 * The chat is RECORDED, not streamed: the client sends the whole thread each turn
 * (server stays stateless), and the reply lands in the event log whenever it lands —
 * which is what makes "ask on site, read at the desk that evening" work (plan §6).
 */

export const CHAT_API_VERSION = 1;

export interface ChatImage {
  mediaId: string;
  width: number;
  height: number;
  dataBase64: string; // JPEG
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  /** Only user turns carry images (the photos the inspector attached that turn). */
  images?: ChatImage[];
}

/** Pin scope: the component under the loupe, plus its zone for orientation. */
export interface PinScopeSnapshot {
  kind: "pin";
  pinNumber: number;
  pinType?: string;
  label?: string;
  flag?: "fine" | "monitor" | "issue" | null;
  zoneLabel?: string;
  zoneType?: string;
  notes: string[];
}

/** Zone scope: the room summary + a pin index (for "what am I looking at" over a room). */
export interface ZoneScopeSnapshot {
  kind: "zone";
  zoneLabel: string;
  zoneType: string;
  pinIndex: { number: number; type?: string; flag?: "fine" | "monitor" | "issue" | null }[];
}

export type ChatScope = PinScopeSnapshot | ZoneScopeSnapshot;

export interface ChatRequest {
  apiVersion: number;
  kind: "chat";
  job: { jobId: string };
  session: { sessionId: string; configHash: string };
  scope: ChatScope;
  thread: ChatTurn[];
}

export interface ChatResponse {
  apiVersion: number;
  kind: "chat";
  jobId: string;
  model: string;
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

/** Error codes carry over from the review protocol (same server envelope shape). */
export type ChatErrorCode =
  | "payload-too-large"
  | "rate-limited"
  | "upstream-unavailable"
  | "timeout"
  | "model-refused"
  | "invalid-request"
  // Client-synthesized: the request reached something that isn't the chat function (a 2xx
  // that isn't our JSON — usually an SPA/index.html fallback because the API base points at
  // the wrong origin, e.g. the native shell hitting capacitor://localhost). Non-retryable.
  | "misrouted"
  | "auth";

export interface ChatErrorEnvelope {
  error: { code: ChatErrorCode; retryable: boolean; retryAfterMs?: number; message: string };
}
