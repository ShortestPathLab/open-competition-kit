import { describe, expect, it } from "bun:test";
import { isPinned, pinnedUri, resolvedFromLock, versionOf } from "./pin";
import { parseRef, type PackageRef } from "./uri";

const ref = (specifier: string): PackageRef => {
  const parsed = parseRef(specifier);
  if (!("scheme" in parsed)) throw new Error(`not a ref: ${specifier}`);
  return parsed;
};

describe("isPinned", () => {
  it("treats a local path as pinned", () => {
    // Nothing resolves it. Whatever is in the directory is what runs, so there is
    // no version for a second host to disagree about.
    expect(isPinned(ref("./packages/noop"))).toBe(true);
    expect(isPinned(ref("/srv/packages/noop"))).toBe(true);
  });

  it("accepts an exact npm version", () => {
    expect(isPinned(ref("npm:@open-competition-kit/standard@0.0.11"))).toBe(true);
    expect(isPinned(ref("npm:@open-competition-kit/standard@1.0.0-rc.2"))).toBe(true);
  });

  it("rejects an npm entry with no version at all", () => {
    expect(isPinned(ref("npm:@open-competition-kit/standard"))).toBe(false);
    expect(isPinned(ref("@open-competition-kit/standard"))).toBe(false);
  });

  it("rejects an npm range or a dist-tag", () => {
    // All of these resolve to whatever the registry is serving today.
    expect(isPinned(ref("npm:@scope/thing@^1.0.0"))).toBe(false);
    expect(isPinned(ref("npm:@scope/thing@~1.0.0"))).toBe(false);
    expect(isPinned(ref("npm:@scope/thing@1.x"))).toBe(false);
    expect(isPinned(ref("npm:@scope/thing@latest"))).toBe(false);
    expect(isPinned(ref("npm:@scope/thing@*"))).toBe(false);
  });

  it("accepts a github commit, short or full", () => {
    expect(isPinned(ref("github:org/repo#98e8ff1"))).toBe(true);
    expect(isPinned(ref("github:org/repo#0123456789abcdef0123456789abcdef01234567"))).toBe(true);
  });

  it("rejects a github tag or branch", () => {
    // A tag can be moved onto a different commit and nothing tells the config
    // that happened, which is the failure this whole check exists to catch.
    expect(isPinned(ref("github:org/repo#v7.0.0"))).toBe(false);
    expect(isPinned(ref("github:org/repo#main"))).toBe(false);
    expect(isPinned(ref("github:org/repo"))).toBe(false);
  });

  it("does not mistake a hex-looking tag for a commit", () => {
    expect(isPinned(ref("github:org/repo#abc"))).toBe(false);
    expect(isPinned(ref("github:org/repo#release"))).toBe(false);
  });
});

describe("versionOf", () => {
  it("takes the version off a registry resolution", () => {
    expect(versionOf("@open-competition-kit/noop@0.0.10", "@open-competition-kit/noop")).toBe(
      "0.0.10",
    );
  });

  it("takes the commit off a git resolution, not the tag that was asked for", () => {
    expect(versionOf("is-number@github:jonschlinkert/is-number#98e8ff1", "is-number")).toBe(
      "98e8ff1",
    );
  });

  it("survives a name it was not given", () => {
    expect(versionOf("0.0.10", "@open-competition-kit/noop")).toBe("0.0.10");
    expect(versionOf("", "x")).toBeUndefined();
  });
});

describe("pinnedUri", () => {
  it("says nothing about an entry that is already pinned", () => {
    expect(pinnedUri(ref("npm:@scope/thing@1.2.3"), "1.2.3")).toBeUndefined();
    expect(pinnedUri(ref("./local"), "1.2.3")).toBeUndefined();
  });

  it("says nothing when nothing recorded what it resolved to", () => {
    // Better to report the entry as unpinned with no advice than to invent a
    // version and have somebody paste it in.
    expect(pinnedUri(ref("npm:@scope/thing"), undefined)).toBeUndefined();
  });

  it("writes an npm entry with its exact version", () => {
    expect(pinnedUri(ref("npm:@scope/thing"), "1.2.3")).toBe("npm:@scope/thing@1.2.3");
  });

  it("writes a github entry with the commit, replacing the tag", () => {
    expect(pinnedUri(ref("github:org/repo#v7.0.0"), "98e8ff1")).toBe("github:org/repo#98e8ff1");
  });
});

describe("resolvedFromLock", () => {
  const lock = `{
  "lockfileVersion": 1,
  "packages": {
    "@open-competition-kit/noop": ["@open-competition-kit/noop@0.0.10", {}, "sha512-aaa=="],
    "is-number": ["is-number@github:jonschlinkert/is-number#98e8ff1", {}, "dir", "sha512-bbb=="],
  }
}`;

  it("finds a scoped registry package", () => {
    expect(resolvedFromLock(lock, "@open-competition-kit/noop")).toBe(
      "@open-competition-kit/noop@0.0.10",
    );
  });

  it("finds a git package", () => {
    expect(resolvedFromLock(lock, "is-number")).toBe(
      "is-number@github:jonschlinkert/is-number#98e8ff1",
    );
  });

  it("reads a lockfile with the trailing commas bun writes", () => {
    // The point of matching rather than parsing: this file is JSONC and
    // `JSON.parse` refuses it outright.
    expect(() => JSON.parse(lock)).toThrow();
    expect(resolvedFromLock(lock, "is-number")).toBeDefined();
  });

  it("returns nothing for a package that is not in the file", () => {
    expect(resolvedFromLock(lock, "absent")).toBeUndefined();
  });

  it("does not let a name with regex characters match the wrong entry", () => {
    expect(resolvedFromLock(lock, "is.number")).toBeUndefined();
  });
});
