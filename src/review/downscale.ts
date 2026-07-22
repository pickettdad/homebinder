/**
 * Review-payload image derivatives: originals never leave the device. Each photo is
 * downscaled to 1024px long edge / JPEG ~q0.72 (~100-250KB) at drain time — plenty for
 * classification/reshoot/anomaly judgment, and what makes chunking under serverless
 * payload caps workable at all. Derivatives are not persisted; retries re-derive.
 *
 * iPad Safari cautions baked in: photos are processed strictly ONE at a time (the killer
 * is total canvas memory, not per-canvas area), bitmaps are closed promptly, and no
 * manual EXIF rotation is applied — 2026-era Safari orients pixels itself, and manual
 * rotation would double-rotate.
 */

const LONG_EDGE = 1024;
const QUALITY = 0.72;

export interface Derivative {
  base64: string;
  width: number;
  height: number;
  bytes: number;
}

export async function downscaleForReview(blob: Blob): Promise<Derivative> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", QUALITY);
    });
    // Release canvas memory eagerly — Safari accounts a device-wide total.
    canvas.width = 0;
    canvas.height = 0;
    const base64 = await blobToBase64(jpeg);
    return { base64, width: w, height: h, bytes: jpeg.size };
  } finally {
    bitmap.close();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const url = reader.result as string; // data:image/jpeg;base64,....
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}
