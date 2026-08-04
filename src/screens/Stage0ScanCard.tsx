/**
 * Stage 0 RoomPlan scan card (Home). Native shell + LiDAR only — invisible in the browser. Its
 * one job is to produce the scan corpus: run Apple's scanner, then hand the CapturedRoom JSON to
 * the share sheet so the owner can AirDrop/save it and send it over. The plan (PLAN-STAGE-0 §6)
 * does all projection/evaluation in the browser harness against that JSON — nothing to render here.
 */
import { useEffect, useState } from "react";
import { isNativePlatform } from "../app/platform";
import { roomPlanSupported, scanRoom, ScanCancelled } from "../native/roomPlan";
import { BigButton, formatBytes } from "../ui/bits";
import { useApp } from "../store/sessionStore";

type Support = "checking" | "yes" | "no";

async function shareScanJson(roomJson: string): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = new File([roomJson], `roomplan-${stamp}.json`, { type: "application/json" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "RoomPlan scan" });
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function Stage0ScanCard() {
  const { showToast } = useApp();
  const [support, setSupport] = useState<Support>("checking");
  const [scanning, setScanning] = useState(false);
  const [lastBytes, setLastBytes] = useState<number | null>(null);

  useEffect(() => {
    if (!isNativePlatform()) {
      setSupport("no");
      return;
    }
    let active = true;
    void roomPlanSupported().then((ok) => {
      if (active) setSupport(ok ? "yes" : "no");
    });
    return () => {
      active = false;
    };
  }, []);

  // Browser/PWA, or native without LiDAR: render nothing — this is a device-only spike tool.
  if (!isNativePlatform() || support === "no") return null;

  const runScan = async () => {
    setScanning(true);
    try {
      const roomJson = await scanRoom();
      setLastBytes(new Blob([roomJson]).size);
      await shareScanJson(roomJson);
      showToast("Scan captured — share it so it lands in the corpus.");
    } catch (err) {
      if (err instanceof ScanCancelled) return; // backing out isn't an error
      showToast(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="rounded-xl border border-brass-800/60 bg-slate-800/60 p-4">
      <h2 className="text-lg font-semibold text-slate-200">Room scan (Stage 0 spike)</h2>
      <p className="mt-1 text-sm text-slate-400">
        Scans a room with Apple RoomPlan and shares the raw plan data. Scan the utility room (twice —
        ambient light, then a work light) and 2–3 main-floor rooms; share each so it reaches the
        corpus we evaluate.
      </p>
      {lastBytes !== null && (
        <p className="mt-2 text-xs text-slate-500">Last scan: {formatBytes(lastBytes)} of plan data.</p>
      )}
      <div className="mt-3">
        <BigButton disabled={support === "checking" || scanning} onClick={() => void runScan()}>
          {scanning ? "Scanning…" : "Scan a room"}
        </BigButton>
      </div>
    </section>
  );
}
