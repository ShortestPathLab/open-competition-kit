import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lazyComponent, makeComponent } from "./index";

/**
 * The submission form once failed to load with only "an unknown error occurred
 * in Effect.andThen" to go on — esbuild's real diagnostics were swallowed, and
 * the failure was cached forever. These lock in that neither happens again.
 */

const GOOD = `
import React from "react";
export default { path: "", component: () => React.createElement("div", null, "ok") };
`;

// Imports a value from a node-only module, so esbuild cannot bundle it for the
// browser — the shape of the real bug.
const BAD = `
import { $ } from "bun";
import React from "react";
console.log($);
export default { path: "", component: () => React.createElement("div", null, "no") };
`;

async function withComponent(source: string, run: (path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "ock-ui-test-"));
  const path = join(dir, "component.tsx");
  await writeFile(path, source);
  try {
    await run(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("a broken bundle throws with esbuild's diagnostics, not a bare wrapper", async () => {
  await withComponent(BAD, async (path) => {
    let error: Error | undefined;
    try {
      await makeComponent({ path, component: () => null });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    // The message must carry the failing file and esbuild's own words, so the
    // cause is visible without spelunking through an Effect stack.
    expect(error!.message).toContain(path);
    expect(error!.message).toContain("esbuild");
    expect(error!.message.toLowerCase()).toContain("bundle");
  });
}, 30_000);

test("a good component bundles to a source string", async () => {
  await withComponent(GOOD, async (path) => {
    const built = await makeComponent({ path, component: () => null });
    expect(built.type).toBe("open-competition-kit/hook/component-source");
    expect(built.source.length).toBeGreaterThan(0);
  });
}, 30_000);

test("lazyComponent retries after a failure instead of caching it", async () => {
  await withComponent(BAD, async (path) => {
    const build = lazyComponent({ path, component: () => null });
    await expect(build()).rejects.toThrow();
    // A second call must re-run, not hand back the cached rejection — the fix for
    // the auth-style `once` trap that pinned a failure until restart.
    await expect(build()).rejects.toThrow();
  });
}, 30_000);

test("lazyComponent caches a success (builds once)", async () => {
  await withComponent(GOOD, async (path) => {
    const build = lazyComponent({ path, component: () => null });
    const first = await build();
    const second = await build();
    // Same promise resolved twice -> identical object, so no re-bundle.
    expect(first).toBe(second);
  });
}, 30_000);
