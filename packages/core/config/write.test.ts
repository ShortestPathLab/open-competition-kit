import { BunContext } from "@effect/platform-bun";
import { afterEach, describe, expect, it } from "bun:test";
import { Effect as E } from "effect";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setConfig, type ConfigEdit, type ConfigWriteResult } from "./write";

const SOURCE = `# The competition, as authored.
appName: GPPC
competitions:
  - id: alpha
    name: Alpha # the friendly name
    organiser: Monash
    tracks:
      - id: main
        name: Main
`;

/** The tree the file above parses to, as far as `walkNodes` is concerned. */
const tree = () => ({
  appName: "GPPC",
  competitions: [
    { id: "alpha", name: "Alpha", organiser: "Monash", tracks: [{ id: "main", name: "Main" }] },
  ],
});

/** No packages installed, so every field belongs to core or to nobody. */
const resolve = () => E.succeed(undefined);

const directories: string[] = [];

const fileWith = (source = SOURCE) => {
  const directory = mkdtempSync(join(tmpdir(), "ock-write-"));
  directories.push(directory);
  const path = join(directory, "competition.config.yaml");
  writeFileSync(path, source);
  return path;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const save = (
  path: string,
  edits: ConfigEdit[],
  check: (source: string) => E.Effect<unknown, unknown, never> = () => E.void,
): Promise<ConfigWriteResult> =>
  E.runPromise(
    setConfig({
      config: tree(),
      edits,
      resolve,
      file: { path, source: readFileSync(path, "utf8") },
      check,
    }).pipe(E.provide(BunContext.layer)),
  );

describe("setConfig", () => {
  it("writes an accepted change into the file it came from", async () => {
    const path = fileWith();

    const result = await save(path, [
      { path: "config.competitions.alpha", values: { name: "Alpha Cup" } },
    ]);

    expect(result.accepted).toBe(true);
    expect(result.stored).toBe(true);
    expect(result.file).toBe(path);
    expect(readFileSync(path, "utf8")).toContain("name: Alpha Cup # the friendly name");
  });

  it("refuses a value core's own schema will not have, and writes nothing", async () => {
    const path = fileWith();

    const result = await save(path, [
      { path: "config.competitions.alpha", values: { name: 42 } },
    ]);

    expect(result.accepted).toBe(false);
    expect(result.stored).toBe(false);
    expect(result.issues[0]?.message).toContain("Expected string");
    expect(readFileSync(path, "utf8")).toBe(SOURCE);
  });

  it("refuses a field somebody else changed since the page was drawn", async () => {
    const path = fileWith();

    const result = await save(path, [
      {
        path: "config.competitions.alpha",
        values: { name: "Alpha Cup" },
        // What this editor was showing. The tree says "Alpha", so the reader was
        // looking at a page drawn before that change landed.
        expect: { name: "Alpha Classic" },
      },
    ]);

    expect(result.accepted).toBe(false);
    expect(result.issues[0]?.message).toContain("changed in the config file");
    expect(readFileSync(path, "utf8")).toBe(SOURCE);
  });

  it("accepts an edit whose field is still what the page showed", async () => {
    const path = fileWith();

    const result = await save(path, [
      {
        path: "config.competitions.alpha",
        values: { name: "Alpha Cup" },
        expect: { name: "Alpha" },
      },
    ]);

    expect(result.stored).toBe(true);
  });

  it("treats a field the page drew as empty as an expectation of its own", async () => {
    const path = fileWith();

    const result = await save(path, [
      {
        path: "config.competitions.alpha",
        values: { description: "New" },
        // The form showed no organiser, and the file has one. Somebody set it in
        // between, and a save from this page would put it back to nothing.
        expect: { organiser: undefined },
      },
    ]);

    expect(result.accepted).toBe(false);
    expect(result.issues[0]?.message).toContain("organiser");
  });

  it("writes nothing when the edited file would not load", async () => {
    const path = fileWith();

    const result = await save(
      path,
      [{ path: "config.competitions.alpha", values: { name: "Alpha Cup" } }],
      // Field validation passes and the document is fine; the thing that refuses
      // is the config as a whole, which is the check that has to happen last.
      () => E.fail(new Error("two competitions share the id alpha")),
    );

    expect(result.accepted).toBe(false);
    expect(result.stored).toBe(false);
    expect(result.issues[0]?.message).toContain("two competitions share the id alpha");
    expect(readFileSync(path, "utf8")).toBe(SOURCE);
  });

  it("reports a change it cannot save, with the lines to paste", async () => {
    const path = fileWith();
    chmodSync(path, 0o444);

    const result = await save(path, [
      { path: "config.competitions.alpha", values: { name: "Alpha Cup" } },
    ]);

    // The values are fine. The deployment is what cannot take them, so the page
    // has something to offer rather than an error to show.
    expect(result.accepted).toBe(true);
    expect(result.stored).toBe(false);
    expect(result.reason).toContain("not writable");
    expect(result.yaml).toContain("name: Alpha Cup");
  });

  it("reports a node the config does not have", async () => {
    const path = fileWith();

    const result = await save(path, [
      { path: "config.competitions.beta", values: { name: "Beta" } },
    ]);

    expect(result.accepted).toBe(false);
    expect(result.issues[0]?.message).toContain("No such node");
  });
});
