import { BunContext } from "@effect/platform-bun";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect as E } from "effect";
import { transform } from "./transform";

let cwd = "";
const previousEnv = process.env.OPEN_COMPETITION_KIT_TEST_VALUE;

const runTransform = <T>(obj: T) =>
  E.runPromise(transform(cwd, obj).pipe(E.provide(BunContext.layer)));

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "ock-transform-"));
  process.env.OPEN_COMPETITION_KIT_TEST_VALUE = "from-env";
  writeFileSync(join(cwd, "included.txt"), "from-file");
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
  if (previousEnv === undefined) {
    delete process.env.OPEN_COMPETITION_KIT_TEST_VALUE;
  } else {
    process.env.OPEN_COMPETITION_KIT_TEST_VALUE = previousEnv;
  }
});

describe("transform", () => {
  test("interpolates environment variables inside strings", async () => {
    const result = await runTransform({
      exact: '${{ env("OPEN_COMPETITION_KIT_TEST_VALUE") }}',
      embedded: 'value=${{ env("OPEN_COMPETITION_KIT_TEST_VALUE") }}',
    });

    expect(result).toEqual({
      exact: "from-env",
      embedded: "value=from-env",
    });
  });

  test("interpolates included files relative to the config directory", async () => {
    const result = await runTransform({
      body: '${{ include("included.txt") }}',
      nested: {
        message: 'prefix ${{ include("included.txt") }} suffix',
      },
    });

    expect(result).toEqual({
      body: "from-file",
      nested: {
        message: "prefix from-file suffix",
      },
    });
  });

  test("leaves strings without supported templates unchanged", async () => {
    const result = await runTransform({
      plain: "no interpolation",
      unsupported: '${{ secret("OPEN_COMPETITION_KIT_TEST_VALUE") }}',
    });

    expect(result).toEqual({
      plain: "no interpolation",
      unsupported: '${{ secret("OPEN_COMPETITION_KIT_TEST_VALUE") }}',
    });
  });
});
