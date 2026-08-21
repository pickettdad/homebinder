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
    private static let limit = 600
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
        if entries.count > limit { entries.removeFirst(entries.count - limit) }
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
            "wrapped": entries.count >= limit,
            "takenAt": ISO8601DateFormatter().string(from: Date())
        ]
    }

    static func clear() {
        lock.lock()
        defer { lock.unlock() }
        entries.removeAll()
    }
}
