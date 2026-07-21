/**
 * Canonical JSON serialization + hashing.
 *
 * The config content hash is computed over a sorted-key, no-whitespace serialization so
 * the same logical config always hashes identically regardless of key order or formatting.
 * Sessions and exports pin this hash: it proves exactly which route definition drove a visit.
 */

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  throw new Error(`canonicalJson: unsupported value type ${typeof value}`);
}

export async function sha256Hex(data: string | ArrayBuffer | Blob): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === "string") buffer = new TextEncoder().encode(data).buffer as ArrayBuffer;
  else if (data instanceof Blob) buffer = await data.arrayBuffer();
  else buffer = data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashConfig(config: unknown): Promise<string> {
  return sha256Hex(canonicalJson(config));
}
