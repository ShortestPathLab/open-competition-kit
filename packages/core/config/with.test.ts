import { BunContext } from "@effect/platform-bun";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect as E } from "effect";
import { applyWith, DEFAULT_PACKAGES } from "./with";

let cwd = "";

const checkout = (dir: string, name?: string) => {
  mkdirSync(join(cwd, dir), { recursive: true });
  if (name) {
    writeFileSync(join(cwd, dir, "package.json"), JSON.stringify({ name }));
  }
};

const run = (config: Record<string, unknown>, defaults?: readonly string[]) =>
  E.runPromise(
    applyWith(config, { cwd, ...(defaults ? { defaults } : {}) }).pipe(E.provide(BunContext.layer)),
  ) as Promise<Record<string, any>>;

const failure = async (config: Record<string, unknown>) => {
  const exit = await E.runPromiseExit(applyWith(config, { cwd }).pipe(E.provide(BunContext.layer)));
  if (exit._tag === "Success") throw new Error("Expected it to fail.");
  return String(exit.cause);
};

/**
 * The defaults with one of them taken out.
 *
 * Derived rather than written down, so that adding a default is a one-line change
 * to the list and not a sweep through this file. Both things these tests are about,
 * a checkout standing in for a default and `without:` dropping one, are about
 * which single entry disappears, not about how many there are.
 *
 * Matched on the prefix because the defaults carry a version. Comparing whole
 * strings would tie every one of these tests to whatever core's version is on the
 * day, and they have nothing to say about versions.
 */
const defaultsExcept = (name: string) =>
  DEFAULT_PACKAGES.filter((uri) => uri !== `npm:${name}` && !uri.startsWith(`npm:${name}@`));

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "ock-with-"));
});
afterEach(() => rmSync(cwd, { recursive: true, force: true }));

describe("canonicalising", () => {
  // The bug: `withAt` deduplicates with `uniq` over raw strings, so one package
  // written two ways joins the chain twice and contributes its config fields
  // twice. Resolving inside the resolver afterwards cannot undo that.
  test("collapses two spellings of one path into one entry", async () => {
    checkout("pkg");
    const config = await run({ with: ["./pkg", "local:./pkg", "./pkg/../pkg"] }, []);
    expect(config.with).toEqual([`local:${join(cwd, "pkg")}`]);
  });

  test("rewrites every list in the tree, not just the root", async () => {
    checkout("pkg");
    const config = await run({
      with: [],
      competitions: [{ id: "a", with: ["./pkg"], tracks: [{ id: "m", with: ["local:./pkg"] }] }],
    });
    const expected = `local:${join(cwd, "pkg")}`;
    expect(config.competitions[0].with).toEqual([expected]);
    expect(config.competitions[0].tracks[0].with).toEqual([expected]);
  });

  test("names the entry it could not read", async () => {
    expect(await failure({ with: ["not a package"] })).toContain("not a package");
  });
});

describe("defaults", () => {
  // Prepended, because the last entry is outermost: `noop` has to stay innermost
  // to terminate a chain, and the rest have to stay inside whatever an organiser
  // installs so their packages can wrap them.
  test("go in front of what the organiser wrote", async () => {
    checkout("mine", "@me/mine");
    const config = await run({ with: ["./mine"] });
    expect(config.with).toEqual([...DEFAULT_PACKAGES, `local:${join(cwd, "mine")}`]);
  });

  // An organiser working on a checkout writes a path. That is the same package as
  // the default, and installing both would put it in the chain twice and then fail
  // to find a copy of it in the package cache.
  test("stand aside for a checkout of the same package", async () => {
    checkout("noop", "@open-competition-kit/noop");
    const config = await run({ with: ["./noop"] });
    expect(config.with).toEqual([
      ...defaultsExcept("@open-competition-kit/noop"),
      `local:${join(cwd, "noop")}`,
    ]);
  });

  test("stand aside for an npm entry naming the same package", async () => {
    const config = await run({ with: ["npm:@open-competition-kit/standard@0.0.11"] });
    expect(config.with).toEqual([
      ...defaultsExcept("@open-competition-kit/standard"),
      "npm:@open-competition-kit/standard@0.0.11",
    ]);
  });

  // A directory with no name suppresses nothing, which is the safe way round: an
  // extra default is a working competition, a missing one is a broken chain.
  test("are unaffected by a checkout that declares no name", async () => {
    checkout("anonymous");
    const config = await run({ with: ["./anonymous"] });
    expect(config.with.slice(0, DEFAULT_PACKAGES.length)).toEqual([...DEFAULT_PACKAGES]);
  });
});

describe("without", () => {
  test("drops a default by name", async () => {
    const config = await run({ with: [], without: ["@open-competition-kit/standard"] });
    expect(config.with).toEqual(defaultsExcept("@open-competition-kit/standard"));
  });

  test("drops a default written as a uri", async () => {
    const config = await run({ with: [], without: ["npm:@open-competition-kit/noop"] });
    expect(config.with).toEqual(defaultsExcept("@open-competition-kit/noop"));
  });

  // Every other unrecognised key in this config is fatal, and a `without:` that
  // silently does nothing is the kind of setting somebody debugs for an hour.
  test("refuses to name something that is not a default", async () => {
    expect(await failure({ with: [], without: ["@me/mine"] })).toContain("not a default package");
  });
});
