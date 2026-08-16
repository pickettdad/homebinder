/**
 * The four pairings that make `cap sync` carry the native plugin — each invisible if it breaks.
 *
 * ⚑ This is the failure class the whole native track is shaped around. `ios/` is generated on
 * every build, so nothing about the plugin is checked by the app's own compiler: if the npm
 * package name and the Swift product name disagree, or the plugin is not a dependency at all,
 * the generated project simply does not contain the plugin — and a build that does not contain
 * it succeeds. July's black screen was diagnosed as *CI-only iteration could not diagnose it*;
 * the durable half of that fix is making the silent failures loud at `npm test` time.
 *
 * These assert invariants, not inventory: nothing here names a method, a field, or a count.
 * Adding methods to the plugin, or a second plugin class, leaves every assertion below true.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { HS_SHELL_JS_NAME } from "../../src/native/hsShell";

const ROOT = process.cwd();
const PLUGIN_DIR = join(ROOT, "native", "hs-native");

const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");
const rootPackage = JSON.parse(read(ROOT, "package.json")) as {
  dependencies?: Record<string, string>;
};
const pluginPackage = JSON.parse(read(PLUGIN_DIR, "package.json")) as {
  name: string;
  version: string;
  capacitor?: { ios?: { src?: string } };
};
const packageSwift = read(PLUGIN_DIR, "Package.swift");
const pluginSwift = read(PLUGIN_DIR, "ios", "Sources", "HsNative", "HSShellPlugin.swift");

/**
 * The Capacitor CLI's own transform (`cli/dist/plugin.js: fixName`), reproduced rather than
 * imported — it is not exported from the package, and a copy that drifts from the real one is
 * caught the moment `cap sync` writes a name this test did not predict.
 */
function fixName(name: string): string {
  const fixed = name
    .replace(/\//g, "_")
    .replace(/-/g, "_")
    .replace(/@/g, "")
    .replace(/_\w/g, (m) => m[1]!.toUpperCase());
  return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}

describe("the native plugin package is wired so `cap sync` finds it", () => {
  it("is a dependency of the app, by a path that exists", () => {
    const spec = rootPackage.dependencies?.[pluginPackage.name];
    expect(spec, `${pluginPackage.name} must be a dependency — cap sync only scans package.json`).toBeDefined();
    const path = spec!.replace(/^file:/, "");
    expect(spec!.startsWith("file:")).toBe(true);
    expect(existsSync(join(ROOT, path, "package.json"))).toBe(true);
  });

  it("declares a capacitor iOS manifest, without which the CLI treats it as a Cordova plugin", () => {
    expect(pluginPackage.capacitor?.ios?.src).toBeTruthy();
  });

  it("names its SPM package and product exactly what the CLI will look for", () => {
    // cap sync writes `.package(name: X, …)` and `.product(name: X, package: X)` where X is
    // fixName(npm name). A Package.swift that calls itself anything else resolves to nothing.
    const expected = fixName(pluginPackage.name);
    expect(packageSwift).toMatch(new RegExp(`name:\\s*"${expected}"`));
    expect(packageSwift).toMatch(new RegExp(`\\.library\\(\\s*name:\\s*"${expected}"`));
  });

  it("has every file it needs IN THE REPO, not merely on this machine", () => {
    // ⚑ The one that got away, 2026-08-14. `.gitignore` carried an unanchored `ios/` — written for
    // the generated project at the root — and git applies such a pattern at every level, so the
    // plugin's only Swift file was never committed. The tethered build read it off local disk and
    // passed; CI checked out a repo without it and could not resolve the package.
    //
    // Nothing else here can catch that: every other assertion in this file reads the working tree,
    // which is exactly the thing that was lying. This one asks git.
    const tracked = new Set(
      execFileSync("git", ["ls-files", "native/hs-native"], { cwd: ROOT, encoding: "utf8" })
        .split("\n")
        .filter(Boolean),
    );

    // Xcode and SwiftPM write build/user state inside the package; those are correctly untracked.
    // ⚑ Named entries, never a pattern. The bug this test exists for was a pattern that matched
    // more than its author meant it to, so an exemption list that could do the same would be the
    // same defect wearing the test's own clothes. `Package.resolved` is on it because the lock
    // that governs resolution is the generated app project's, not this package's.
    const IGNORED = new Set([".swiftpm", ".build", "node_modules", "Package.resolved"]);
    const onDisk: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (IGNORED.has(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else onDisk.push(relative(ROOT, full).split(sep).join("/"));
      }
    };
    walk(PLUGIN_DIR);

    expect(onDisk.length).toBeGreaterThan(0);
    expect(onDisk.filter((f) => !tracked.has(f))).toEqual([]);
  });

  it("keeps the Swift deployment floor no higher than the app project's", () => {
    // A floor above the generated app's (.iOS(.v15)) fails SPM resolution at build time, which
    // reads as "the plugin broke the build" rather than "the two manifests disagree".
    const floor = /platforms:\s*\[\.iOS\(\.v(\d+)\)\]/.exec(packageSwift)?.[1];
    expect(floor, "Package.swift must declare an iOS platform floor").toBeDefined();
    expect(Number(floor)).toBeLessThanOrEqual(15);
  });
});

describe("the two sides of the bridge agree on the names they never see each other use", () => {
  it("addresses the plugin by the jsName the Swift declares", () => {
    const jsName = /jsName\s*=\s*"([^"]+)"/.exec(pluginSwift)?.[1];
    expect(jsName, "HSShellPlugin must declare a jsName").toBeDefined();
    expect(HS_SHELL_JS_NAME).toBe(jsName);
  });

  it("reports the version the package declares", () => {
    // The two runs are compared on plugin version; that comparison is only meaningful if the
    // number the plugin *says* is the number the package *is*.
    const swiftVersion = /static let version\s*=\s*"([^"]+)"/.exec(pluginSwift)?.[1];
    expect(swiftVersion).toBe(pluginPackage.version);
  });
});
