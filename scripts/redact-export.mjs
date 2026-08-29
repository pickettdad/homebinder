#!/usr/bin/env node
/**
 * Turn a real export into one that can live in a public repo.
 *
 * ⚑ **The repo is public and the photographs are not** (register #147). Builder's receiver is
 * blocked on a real export and on nothing else — so the export has to be real in every way that
 * a receiver can observe, and unreal in exactly one way: the pixels.
 *
 * ## The policy, in one place so it can be argued with in one line
 *
 * | | |
 * |---|---|
 * | **Photograph, video, voice bytes** | ⛑ **Replaced.** A placeholder of the same mime, and `bytes`/`sha256` rewritten to match it, so the export stays internally consistent and a receiver that verifies hashes still passes |
 * | **Geometry payloads** (`kind: "geometry"`) | ⚑ **Kept verbatim.** They are numbers, and they are the thing the desk pass must be built against. A redacted floorplan would defeat the purpose of sending one |
 * | **Text that names a household** | Property label, zone and pin labels, note bodies, chat messages, and `read.text` — a plate read is a serial number |
 * | **Everything else** | ⚑ **Kept.** Ids, timestamps, positions, transforms, intents, kinds, roles, totals, resolutions, the config snapshot. *That is the contract; redacting it would ship a shape rather than an export* |
 *
 * ## And it declares itself
 *
 * ⛑ A `redaction` block is written into the manifest naming what was replaced and by what rule.
 * **Nobody may mistake this for a capture record** — a fixture that looks like real evidence is
 * how a fabricated reading ends up quoted as a measurement.
 *
 * Usage:  node scripts/redact-export.mjs <input-dir> <output-dir>
 * Dev-only. Shells out to `unzip`/`zip`, which is why it is a script and not app code.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";

const REDACTED_TEXT = "[redacted]";

/** A 16×16 mid-grey JPEG. Valid, decodable, and unmistakably not a photograph of anything. */
const PLACEHOLDER_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAQABABAREA/8QAHwAAAQUBAQEB" +
    "AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh" +
    "ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ" +
    "WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG" +
    "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiiiiiiiiiiv/9k=",
  "base64",
);
/** A short silent-ish placeholder for anything that is not an image. Kind is declared, not faked. */
const PLACEHOLDER_BYTES = Buffer.from("housesteady-redacted-placeholder\n", "utf8");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const placeholderFor = (mime) =>
  mime?.startsWith("image/") ? PLACEHOLDER_JPEG : PLACEHOLDER_BYTES;

/** Replace a string in place if it is a non-empty string. Returns whether it changed. */
function redactField(obj, key, counter) {
  if (obj && typeof obj[key] === "string" && obj[key].length > 0 && obj[key] !== REDACTED_TEXT) {
    obj[key] = REDACTED_TEXT;
    counter.text += 1;
  }
}

function redactManifest(manifest, counter) {
  redactField(manifest.session, "propertyLabel", counter);
  for (const zone of manifest.zones ?? []) redactField(zone, "label", counter);
  for (const pin of manifest.pins ?? []) redactField(pin, "label", counter);
  for (const note of manifest.notes ?? []) {
    redactField(note, "text", counter);
    redactField(note, "body", counter);
  }
  for (const thread of manifest.chats ?? [])
    for (const message of thread.messages ?? []) redactField(message, "content", counter);

  for (const m of manifest.media ?? []) {
    // ⚑ A plate read is a serial number. The SHAPE — engine, confidence, osVersion — is what the
    // binder consumes and every bit of it stays; only the transcription goes.
    if (m.read) redactField(m.read, "text", counter);
    if (m.kind === "geometry") {
      counter.geometryKept += 1;
      continue;
    }
    const placeholder = placeholderFor(m.mime);
    m.bytes = placeholder.length;
    m.sha256 = sha256(placeholder);
    counter.mediaReplaced += 1;
  }
  return manifest;
}

function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error("usage: node scripts/redact-export.mjs <input-dir> <output-dir>");
    process.exit(2);
  }
  const names = readdirSync(input);
  const manifestName = names.find((n) => n.endsWith("-manifest.json"));
  if (!manifestName) {
    console.error(`no *-manifest.json in ${input} — is that an export directory?`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(join(input, manifestName), "utf8"));
  const counter = { text: 0, mediaReplaced: 0, geometryKept: 0, filesRewritten: 0 };
  const keepVerbatim = new Set(
    (manifest.media ?? []).filter((m) => m.kind === "geometry").map((m) => m.file),
  );

  redactManifest(manifest, counter);

  mkdirSync(output, { recursive: true });

  for (const name of names.filter((n) => n.endsWith(".zip"))) {
    const work = mkdtempSync(join(tmpdir(), "hs-redact-"));
    try {
      execFileSync("unzip", ["-q", join(input, name), "-d", work]);
      const walk = (dir) =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
        );
      for (const file of walk(work)) {
        const rel = file.slice(work.length + 1);
        if (keepVerbatim.has(rel)) continue;
        const placeholder = placeholderFor(basename(rel).endsWith(".jpg") ? "image/jpeg" : "");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, placeholder);
        counter.filesRewritten += 1;
      }
      // `-r .` from inside the work dir, so paths inside the zip stay relative as the manifest
      // records them. A rebuilt zip with absolute paths is a zip nothing can find its media in.
      execFileSync("zip", ["-q", "-r", join(output, name), "."], { cwd: work });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }

  /*
    ⛑ **The export says what was done to it.** A redacted fixture that does not declare itself is
    indistinguishable from a capture record, and this project's own rule is that a fabricated
    reading must never be quotable as a measurement.
  */
  manifest.redaction = {
    redactedAt: new Date().toISOString(),
    tool: "scripts/redact-export.mjs",
    note:
      "REDACTED. Not a capture record. Photograph, video and voice bytes were replaced with " +
      "placeholders and their bytes/sha256 rewritten to match, so the export is internally " +
      "consistent. Geometry payloads, positions, transforms, ids, timings, kinds, intents, roles, " +
      "totals and the config snapshot are VERBATIM. Text that names a household was replaced with " +
      `"${REDACTED_TEXT}".`,
    mediaFilesReplaced: counter.mediaReplaced,
    geometryFilesKeptVerbatim: counter.geometryKept,
    textFieldsRedacted: counter.text,
  };
  writeFileSync(join(output, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `redacted → ${output}\n` +
      `  media replaced:  ${counter.mediaReplaced}\n` +
      `  geometry kept:   ${counter.geometryKept}\n` +
      `  text redacted:   ${counter.text}\n` +
      `  files rewritten: ${counter.filesRewritten}`,
  );
}

main();
