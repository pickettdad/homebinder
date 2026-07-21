/** Object-URL lifecycle for media thumbnails / playback. */
import { useEffect, useState } from "react";
import { db } from "../storage/db";

export function useMediaUrl(mediaId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!mediaId) { setUrl(null); return; }
    let objectUrl: string | null = null;
    let cancelled = false;
    void db.media.get(mediaId).then((row) => {
      if (row && !cancelled) {
        objectUrl = URL.createObjectURL(row.blob);
        setUrl(objectUrl);
      }
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);
  return url;
}
