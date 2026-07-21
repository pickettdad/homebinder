/**
 * The fold: (pinned config snapshot, event log) -> session state.
 *
 * Pure and total. Rules that keep replay deterministic and forward-compatible:
 *  - reads ONLY the config snapshot and event payloads — never the live config module
 *  - unknown event types are ignored (a newer app can replay an older log and vice versa)
 *  - events referencing unknown slot instances are kept as orphans, never dropped
 */
import type { RouteConfig } from "./schema/routeConfig";
import type { RoomInstance, SessionEvent, Source } from "./schema/events";
import { compilePlan, type PlanSlot, type SessionPlan } from "./plan";

export interface CaptureRef {
  mediaId: string;
  sha256: string;
  mime: string;
  bytes: number;
  at: string;
  durationMs?: number;
  source: Source;
}

export interface ExceptionState {
  reasonId: string;
  note?: string;
  at: string;
  source: Source;
}

export interface SlotState extends PlanSlot {
  photos: CaptureRef[];
  voiceNotes: CaptureRef[];
  exception?: ExceptionState;
}

export interface ZoneState {
  zoneId: string;
  label: string;
  intro?: string;
  gate: "open" | "closed";
  closedAt?: string;
  slots: SlotState[];
}

export interface SessionState {
  sessionId: string;
  routeId: string;
  configVersion: string;
  configHash: string;
  propertyLabel?: string;
  flags: string[];
  rooms: RoomInstance[];
  zones: ZoneState[];
  startedAt?: string;
  completedAt?: string;
  lastEventSeq: number;
  /** Last slot/zone the inspector touched — resume lands here. */
  lastActiveZoneId?: string;
  lastActiveSlotId?: string;
  /** Events referencing slots that no longer resolve (e.g. a removed room). Exported, never lost. */
  orphanEvents: SessionEvent[];
}

export function fold(config: RouteConfig, events: readonly SessionEvent[]): SessionState {
  const init = events.find((e) => e.type === "SessionInitialized");
  if (!init || init.type !== "SessionInitialized") throw new Error("event log has no SessionInitialized");

  // Pass 1: room roster (plan inputs) from the whole log, so instance ids resolve
  // regardless of interleaving.
  const rooms = new Map<string, RoomInstance>();
  for (const e of events) {
    if (e.type === "RoomAdded") rooms.set(e.room.roomInstanceId, e.room);
    else if (e.type === "RoomRemoved") rooms.delete(e.roomInstanceId);
  }

  const roomList = [...rooms.values()];
  const plan: SessionPlan = compilePlan(config, init.flags, roomList);

  const state: SessionState = {
    sessionId: init.sessionId,
    routeId: init.routeId,
    configVersion: init.configVersion,
    configHash: init.configHash,
    propertyLabel: init.propertyLabel,
    flags: init.flags,
    rooms: roomList,
    zones: plan.zones.map((z) => ({
      zoneId: z.zoneId,
      label: z.label,
      intro: z.intro,
      gate: "open",
      slots: z.slots.map((s) => ({ ...s, photos: [], voiceNotes: [] })),
    })),
    startedAt: init.at,
    lastEventSeq: 0,
    orphanEvents: [],
  };

  const slotIndex = new Map<string, SlotState>();
  for (const zone of state.zones) for (const slot of zone.slots) slotIndex.set(slot.instanceId, slot);
  const zoneIndex = new Map(state.zones.map((z) => [z.zoneId, z]));

  const touch = (slotInstanceId: string) => {
    const slot = slotIndex.get(slotInstanceId);
    if (slot) {
      state.lastActiveSlotId = slot.instanceId;
      state.lastActiveZoneId = slot.zoneId;
    }
  };

  // Pass 2: apply in sequence order.
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    state.lastEventSeq = Math.max(state.lastEventSeq, e.seq);
    switch (e.type) {
      case "SessionInitialized":
      case "RoomAdded":
      case "RoomRemoved":
        break; // handled in pass 1
      case "PhotoCaptured": {
        const slot = slotIndex.get(e.slotInstanceId);
        if (!slot) { state.orphanEvents.push(e); break; }
        slot.photos.push({ ...e.media, at: e.at, source: e.source });
        touch(e.slotInstanceId);
        break;
      }
      case "PhotoDiscarded": {
        const slot = slotIndex.get(e.slotInstanceId);
        if (!slot) { state.orphanEvents.push(e); break; }
        slot.photos = slot.photos.filter((p) => p.mediaId !== e.mediaId);
        break;
      }
      case "VoiceNoteAttached": {
        const slot = slotIndex.get(e.slotInstanceId);
        if (!slot) { state.orphanEvents.push(e); break; }
        slot.voiceNotes.push({ ...e.media, at: e.at, durationMs: e.durationMs, source: e.source });
        touch(e.slotInstanceId);
        break;
      }
      case "VoiceNoteDiscarded": {
        const slot = slotIndex.get(e.slotInstanceId);
        if (!slot) { state.orphanEvents.push(e); break; }
        slot.voiceNotes = slot.voiceNotes.filter((v) => v.mediaId !== e.mediaId);
        break;
      }
      case "ExceptionRecorded": {
        const slot = slotIndex.get(e.slotInstanceId);
        if (!slot) { state.orphanEvents.push(e); break; }
        slot.exception = { reasonId: e.reasonId, note: e.note, at: e.at, source: e.source };
        touch(e.slotInstanceId);
        break;
      }
      case "ExceptionCleared": {
        const slot = slotIndex.get(e.slotInstanceId);
        if (!slot) { state.orphanEvents.push(e); break; }
        slot.exception = undefined;
        break;
      }
      case "ZoneClosed": {
        const zone = zoneIndex.get(e.zoneId);
        if (!zone) { state.orphanEvents.push(e); break; }
        zone.gate = "closed";
        zone.closedAt = e.at;
        break;
      }
      case "ZoneReopened": {
        const zone = zoneIndex.get(e.zoneId);
        if (!zone) { state.orphanEvents.push(e); break; }
        zone.gate = "open";
        zone.closedAt = undefined;
        break;
      }
      case "SessionCompleted":
        state.completedAt = e.at;
        break;
      case "ExportProduced":
        break;
      default: {
        // Unknown event type from a different app version: ignore, never crash.
        break;
      }
    }
  }

  return state;
}
