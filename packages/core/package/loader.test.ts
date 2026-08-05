import type { FileSystem, Path } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect as E } from "effect";
import { loaderFor, MANIFEST_FILE, readManifest } from "./loader";
import { parseRef, type PackageRef } from "./uri";

let root = "";

const pkg = (name: string, files: Record<string, string>) => {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    writeFileSync(join(dir, file), contents);
  }
  return dir;
};

const ref = (uri: string) => parseRef(uri) as PackageRef;

const run = <A, Err>(effect: E.Effect<A, Err, FileSystem.FileSystem | Path.Path>) =>
  E.runPromise(effect.pipe(E.provide(BunContext.layer)));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ock-loader-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("selection", () => {
  // Every package that exists today has a `package.json` and no manifest, which
  // is why none of them need editing for any of this.
  test("reads a package with no manifest as JavaScript", async () => {
    const dir = pkg("plain", { "package.json": `{"name":"plain"}` });
    const { loader } = await run(loaderFor(dir, ref("local:/plain")));
    expect(loader.id).toBe("js");
  });

  test("reads an explicit js runtime as JavaScript", async () => {
    const dir = pkg("declared", {
      "package.json": `{"name":"declared"}`,
      [MANIFEST_FILE]: `{"runtime":"js"}`,
    });
    const { loader } = await run(loaderFor(dir, ref("local:/declared")));
    expect(loader.id).toBe("js");
  });

  // The point of the stub. Selecting on the manifest rather than the uri is what
  // keeps acquisition and language orthogonal, and it is what makes the refusal
  // name the package instead of failing as an import of a directory with no
  // `package.json` in it.
  test("claims another runtime rather than leaving it to the JS loader", async () => {
    const dir = pkg("py", { [MANIFEST_FILE]: `{"runtime":"python","entry":"main.py"}` });
    const { loader } = await run(loaderFor(dir, ref("local:/py")));
    expect(loader.id).toBe("unsupported-runtime");
  });
});

describe("an unsupported runtime", () => {
  test("refuses at load, naming the runtime", async () => {
    const dir = pkg("py", { [MANIFEST_FILE]: `{"runtime":"python"}` });
    const { loader, manifest } = await run(loaderFor(dir, ref("local:/py")));
    const exit = await E.runPromiseExit(
      loader
        .start(dir, ref("npm:@someone/their-python-package"), manifest)
        .pipe(E.provide(BunContext.layer)),
    );
    expect(exit._tag).toBe("Failure");
    expect(String(exit)).toContain("python");
    expect(String(exit)).toContain("wire protocol");
  });
});

describe("manifests", () => {
  test("are absent rather than fatal when there is no file", async () => {
    const dir = pkg("plain", { "package.json": "{}" });
    expect(await run(readManifest(dir))).toBeUndefined();
  });

  // A manifest nobody can parse should not decide what language a package is in.
  test("are absent rather than fatal when the file is broken", async () => {
    const dir = pkg("broken", { [MANIFEST_FILE]: "{not json" });
    expect(await run(readManifest(dir))).toBeUndefined();
  });
});
