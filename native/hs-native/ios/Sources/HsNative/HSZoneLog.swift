import Foundation

/**
 What the zone session did, kept by the app rather than by whoever was watching.

 ⛑ **Built because the tether failed twice and the second failure cost a walk.** `devicectl process
 launch --console` attached, reported the app launched, and then delivered nothing — the same command
 that had worked an hour earlier. The console was the only record of what a zone session was doing,
 so when it went quiet there was no evidence at all and the owner had walked a kitchen for nothing.

 ⚑ **An instrument that only works while somebody is watching is not an instrument.** This is the
 same shape as the traverse JSON, which has never failed once: the device records, the concierge
 taps share, and the evidence arrives whether or not a Mac was plugged in. A ring buffer because a
 log that can fill up is a log that stops recording exactly when a run goes long.

 Cheap on purpose — a timestamp, a word, and a small dictionary — so it can sit in the frame path
 without becoming the thing it is measuring.
 */
enum HSZoneLog {
    /**
     ⚑ **Sized for a whole untethered walk, not a tethered experiment** (2026-08-29).

     600 was right while every run was watched live on a cable: the console had the beginning and
     the file only had to hold the end. **The first real walk is untethered** — several rooms, a
     mechanical room captured every way it can be, traverse legs, floorplans, meshes — and this file
     is then the *only* record of what the app did. At roughly five rows per capture, 600 wraps
     partway through the first room and **silently hands back a beginning that is not the beginning.**
    */
    private static let limit = 3000
    /// ⛑ **How many rows were dropped, not merely that some were.** `wrapped: true` tells a reader
    /// the record is incomplete and nothing about how incomplete — which is the difference between
    /// *you lost a little* and *you lost the first room*.
    private static var dropped = 0
    private static var entries: [[String: Any]] = []
    private static let lock = NSLock()
    private static let started = Date()

    static func record(_ what: String, _ detail: [String: Any] = [:]) {
        lock.lock()
        defer { lock.unlock() }
        var row: [String: Any] = [
            // Seconds since launch rather than a wall clock: the question is always *what happened
            // in what order and how long apart*, and a clock makes that arithmetic the reader's job.
            "t": Date().timeIntervalSince(started),
            "what": what
        ]
        for (k, v) in detail { row[k] = v }
        entries.append(row)
        if entries.count > limit {
            let excess = entries.count - limit
            entries.removeFirst(excess)
            dropped += excess
        }
        flush()
        // Still NSLogged, so a working tether sees it live. The file is the record; the console is
        // a convenience — which is the right way round and was the wrong way round before.
        NSLog("HS-ZONE %@ %@", what, String(describing: detail))
    }

    static func snapshot() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return [
            "entries": entries,
            "count": entries.count,
            // ⚑ Said out loud: a ring buffer that has wrapped is not a complete record, and a reader
            // who cannot tell has been handed a beginning that is not the beginning.
            // ⚑ `dropped > 0` is the honest test. `count >= limit` calls a buffer that is merely
            // FULL a buffer that has lost something, which are different facts.
            "wrapped": dropped > 0,
            "dropped": dropped,
            "takenAt": ISO8601DateFormatter().string(from: Date())
        ]
    }

    /**
     ⚑ **Written to disk on every entry, so the record needs nobody's cooperation.**

     Three channels have now failed in the way that matters — a console attach that reported the app
     launched and then delivered nothing, a device syslog that relays system chatter but not our
     `NSLog`, and a share button that depends on the concierge remembering to press it after a run
     has already gone wrong. **This file needs none of them:** it is in the app's Documents
     container and can be pulled off a tethered device with one command while the app is running,
     closed, or crashed.

     Cheap enough to do per entry — a few hundred small rows — and doing it per entry rather than at
     some tidy moment is the point: **a log flushed at the end is a log you do not have when the
     thing you were watching took the app down with it.**
     */
    private static func flush() {
        guard let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        else { return }
        let url = dir.appendingPathComponent("hs-zone-log.json")
        /* ⛑ Not pretty-printed. This is written on EVERY entry, and at 3000 rows the whitespace is
           most of the bytes — a cost paid thousands of times during a walk so that a file nobody
           reads by eye can be indented. It is machine-read; the reader pretty-prints. */
        guard let data = try? JSONSerialization.data(
            withJSONObject: ["entries": entries, "count": entries.count,
                             "wrapped": dropped > 0, "dropped": dropped,
                             "takenAt": ISO8601DateFormatter().string(from: Date())],
            options: []) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func clear() {
        lock.lock()
        defer { lock.unlock() }
        entries.removeAll()
        dropped = 0
    }
}
