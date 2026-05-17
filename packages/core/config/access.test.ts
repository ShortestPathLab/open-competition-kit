import { describe, expect, test } from "bun:test";
import { Effect as E } from "effect";
import { access, accessRecursive } from "./access";

const config = {
  appName: "Test Kit",
  appDescription: "A test config",
  auth: {},
  db: {},
  secrets: {},
  with: ["root-package"],
  competitions: [
    {
      id: "alpha",
      with: ["alpha-package"],
      name: "Alpha",
      tracks: [
        {
          id: "main",
          with: ["main-package"],
          name: "Main Track",
        },
      ],
    },
    {
      id: "beta",
      with: ["beta-package"],
      name: "Beta",
      tracks: [
        {
          id: "secondary",
          with: ["secondary-package"],
          name: "Secondary Track",
        },
      ],
    },
  ],
};

describe("accessRecursive", () => {
  test("selects an item from an extendable collection by id", () => {
    const competition = accessRecursive(
      { competitions: "alpha" } as never,
      config,
    );

    expect(competition).toMatchObject({
      id: "alpha",
      name: "Alpha",
      with: ["alpha-package"],
    });
  });

  test("flattens nested collections before selecting by id", () => {
    const track = accessRecursive(
      { competitions: { tracks: "secondary" } } as never,
      config,
    );

    expect(track).toMatchObject({
      id: "secondary",
      name: "Secondary Track",
      with: ["secondary-package"],
    });
  });

  test("returns the current extendable object for a true accessor", () => {
    const competition = accessRecursive(
      true as never,
      config.competitions[0],
    ) as unknown;

    expect(competition).toBe(config.competitions[0]);
  });
});

describe("access", () => {
  test("wraps malformed access in ConfigAccessorError", async () => {
    const result = await E.runPromise(
      E.either(access({ competitions: { missing: true } } as never, config)),
    );

    expect(result).toMatchObject({
      _tag: "Left",
      left: { _tag: "ConfigAccessorError" },
    });
  });
});
