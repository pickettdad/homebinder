/**
 * The wire contract between the PWA and the review function. Shared by client and
 * server (the Netlify function imports these types), versioned independently of the
 * route config.
 */

export const REVIEW_API_VERSION = 1;

export interface ReviewSlotMeta {
  slotInstanceId: string;
  defId: string;
  label: string;
  guidance?: string;
}

export interface ReviewImage {
  mediaId: string;
  slotInstanceId: string;
  width: number;
  height: number;
  dataBase64: string; // JPEG
}

export interface ZoneSummaryRequest {
  apiVersion: number;
  kind: "zone-summary";
  job: { jobId: string; chunk: { index: number; of: number } };
  session: { sessionId: string; routeId: string; configHash: string };
  zone: { zoneId: string; label: string; flags: string[] };
  slots: ReviewSlotMeta[];
  images: ReviewImage[];
}

export interface WireFinding {
  findingId: string;
  slotInstanceId: string;
  mediaIds: string[];
  severity: "info" | "reshoot" | "anomaly";
  message: string;
  confidence: number;
}

export interface ZoneSummaryResponse {
  apiVersion: number;
  kind: "zone-summary";
  jobId: string;
  model: string;
  findings: WireFinding[];
  usage: { inputTokens: number; outputTokens: number };
}

export type ReviewErrorCode =
  | "payload-too-large"
  | "rate-limited"
  | "upstream-unavailable"
  | "timeout"
  | "model-refused"
  | "invalid-request"
  | "auth";

export interface ReviewErrorEnvelope {
  error: { code: ReviewErrorCode; retryable: boolean; retryAfterMs?: number; message: string };
}
