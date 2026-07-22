/**
 * Pure chunking logic for zone-review jobs (unit-tested; no I/O).
 *
 * Jobs are chunked by photo count at enqueue time (byte sizes aren't known until
 * derivatives are generated at drain time); the drain applies a byte guard on the
 * assembled payload and the server 413 path re-chunks at half size.
 */
export const MAX_PHOTOS_PER_JOB = 8;

export interface ChunkInput {
  slotInstanceId: string;
  mediaId: string;
}

export function chunkZonePhotos(photos: ChunkInput[], maxPerChunk = MAX_PHOTOS_PER_JOB): ChunkInput[][] {
  if (photos.length === 0) return [];
  const chunks: ChunkInput[][] = [];
  for (let i = 0; i < photos.length; i += maxPerChunk) chunks.push(photos.slice(i, i + maxPerChunk));
  return chunks;
}
