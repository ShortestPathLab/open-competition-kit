import { describe, expect, test } from "bun:test";
import { Effect as E } from "effect";
import { migrate } from "./migrate";

const run = (config: unknown) => E.runSync(migrate(config));

describe("migrate", () => {
  test("moves a renamed block to its current name", () => {
    expect(run({ appName: "x", largeFiles: { root: "/data" } })).toEqual({
      appName: "x",
      files: { root: "/data" },
    });
  });

  test("keeps the current name when both are present", () => {
    // Mid-edit, which is the state a half-finished rename leaves a file in. The
    // current name wins and the warning says the other one is being dropped,
    // rather than the two being merged into something the organiser never wrote.
    expect(
      run({ largeFiles: { root: "/old" }, files: { root: "/new" } }),
    ).toEqual({ files: { root: "/new" } });
  });

  test("moves a sandbox: ceiling onto the machine that enforces it", () => {
    expect(run({ appName: "x", sandbox: { memoryMb: 2048 } })).toEqual({
      appName: "x",
      machine: { memoryMb: 2048 },
    });
  });

  test("leaves a config that never used the old name alone", () => {
    const config = { appName: "x", files: { root: "/data" } };
    expect(run(config)).toEqual(config);
  });

  test("passes through anything that is not a config object", () => {
    // An empty file parses to undefined and a list parses to an array. Neither
    // is this function's problem: the schema is what reports them, and with a
    // better error than a crash in here would give.
    expect(run(undefined)).toBeUndefined();
    expect(run(null)).toBeNull();
    expect(run([1, 2])).toEqual([1, 2]);
    expect(run("appName: x")).toBe("appName: x");
  });
});
