import { BunContext } from "@effect/platform-bun";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect as E, Exit, LogLevel, Logger, Option } from "effect";
import { MAX_DATA_URL_BYTES, transform } from "./transform";

let cwd = "";
const previousEnv = process.env.OPEN_COMPETITION_KIT_TEST_VALUE;

// The unrecognised-operator warning is the subject of one test and noise in the
// rest, so no test prints it.
const run = (obj: unknown) =>
  transform(cwd, obj).pipe(
    Logger.withMinimumLogLevel(LogLevel.None),
    E.provide(BunContext.layer),
  );

// `transform` returns `unknown`, since `yaml` can change the shape of what it
// was given. Every assertion below names the shape it expects anyway.
const runTransform = (obj: unknown) => E.runPromise(run(obj)) as Promise<any>;

const failureMessage = async (obj: unknown) => {
  const exit = await E.runPromiseExit(run(obj));
  if (Exit.isSuccess(exit)) throw new Error("expected a failure");
  return Option.getOrThrow(Cause.failureOption(exit.cause)).message;
};

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

describe("env", () => {
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

  test("uses the fallback when the variable is unset", async () => {
    const result = await runTransform({
      missing: '${{ env("OPEN_COMPETITION_KIT_ABSENT", "fallback") }}',
      present: '${{ env("OPEN_COMPETITION_KIT_TEST_VALUE", "fallback") }}',
    });

    expect(result).toEqual({ missing: "fallback", present: "from-env" });
  });

  test("fails on an unset variable with no fallback", async () => {
    const message = await failureMessage({
      missing: '${{ env("OPEN_COMPETITION_KIT_ABSENT") }}',
    });

    expect(message).toContain("OPEN_COMPETITION_KIT_ABSENT is not set");
    expect(message).toContain("config.missing");
  });

  test("fails when an operator is given the wrong number of arguments", async () => {
    const message = await failureMessage({
      wrong: '${{ env("A", "B", "C") }}',
    });

    expect(message).toContain("env() takes 1 or 2 arguments");
  });
});

describe("text", () => {
  test("reads files relative to the config directory", async () => {
    const result = await runTransform({
      body: '${{ text("included.txt") }}',
      nested: { message: 'prefix ${{ text("included.txt") }} suffix' },
    });

    expect(result).toEqual({
      body: "from-file",
      nested: { message: "prefix from-file suffix" },
    });
  });

  test("names the file and the config path when the file is missing", async () => {
    const message = await failureMessage({
      overview: '${{ text("absent.md") }}',
    });

    expect(message).toContain("absent.md could not be read");
    expect(message).toContain("config.overview");
  });
});

describe("dataUrl", () => {
  test("inlines a file as a data URL, typed from its extension", async () => {
    writeFileSync(join(cwd, "logo.svg"), "<svg/>");
    writeFileSync(join(cwd, "logo.png"), Buffer.from([0x89, 0x50]));

    const result = await runTransform({
      svg: '${{ dataUrl("logo.svg") }}',
      png: '${{ dataUrl("logo.png") }}',
    });

    expect(result).toEqual({
      svg: `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`,
      png: "data:image/png;base64,iVA=",
    });
  });

  test("embeds in markdown, which is the point of it being a URL", async () => {
    writeFileSync(join(cwd, "logo.svg"), "<svg/>");

    const result = await runTransform({
      overview: '![logo](${{ dataUrl("logo.svg") }})',
    });

    expect(result.overview).toBe(
      `![logo](data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")})`,
    );
  });

  test("falls back to octet-stream for an unknown extension", async () => {
    writeFileSync(join(cwd, "thing.zzz"), "x");

    const result = await runTransform({ file: '${{ dataUrl("thing.zzz") }}' });

    expect(result.file).toBe("data:application/octet-stream;base64,eA==");
  });

  test("refuses a file over the inline limit", async () => {
    writeFileSync(join(cwd, "big.png"), Buffer.alloc(MAX_DATA_URL_BYTES + 1));

    const message = await failureMessage({ logo: '${{ dataUrl("big.png") }}' });

    expect(message).toContain(`over the ${MAX_DATA_URL_BYTES} byte limit`);
  });

  test("reads bytes rather than text, so binary survives", async () => {
    const bytes = Buffer.from([0x00, 0xff, 0xfe, 0x80]);
    writeFileSync(join(cwd, "bin.png"), bytes);

    const result = await runTransform({ file: '${{ dataUrl("bin.png") }}' });

    expect(result.file).toBe(
      `data:image/png;base64,${bytes.toString("base64")}`,
    );
  });
});

describe("yaml", () => {
  test("splices a parsed document in as a node", async () => {
    writeFileSync(
      join(cwd, "competition.yaml"),
      "id: fit5047\ntracks:\n  - id: main\n",
    );

    const result = await runTransform({
      competitions: ['${{ yaml("competition.yaml") }}'],
    });

    expect(result).toEqual({
      competitions: [{ id: "fit5047", tracks: [{ id: "main" }] }],
    });
  });

  test("resolves the included document's own templates against its directory", async () => {
    mkdirSync(join(cwd, "competitions"));
    writeFileSync(join(cwd, "competitions", "rules.md"), "the rules");
    writeFileSync(
      join(cwd, "competitions", "one.yaml"),
      'id: one\nrules: ${{ text("rules.md") }}\nowner: ${{ env("OPEN_COMPETITION_KIT_TEST_VALUE") }}\n',
    );

    const result = await runTransform({
      competitions: ['${{ yaml("competitions/one.yaml") }}'],
    });

    expect(result).toEqual({
      competitions: [{ id: "one", rules: "the rules", owner: "from-env" }],
    });
  });

  test("includes through more than one level", async () => {
    mkdirSync(join(cwd, "tracks"));
    writeFileSync(join(cwd, "tracks", "main.yaml"), "id: main\n");
    writeFileSync(
      join(cwd, "competition.yaml"),
      'id: one\ntracks:\n  - ${{ yaml("tracks/main.yaml") }}\n',
    );

    const result = await runTransform({
      competitions: ['${{ yaml("competition.yaml") }}'],
    });

    expect(result).toEqual({
      competitions: [{ id: "one", tracks: [{ id: "main" }] }],
    });
  });

  test("reports a cycle instead of recursing forever", async () => {
    writeFileSync(join(cwd, "a.yaml"), 'b: ${{ yaml("b.yaml") }}\n');
    writeFileSync(join(cwd, "b.yaml"), 'a: ${{ yaml("a.yaml") }}\n');

    const message = await failureMessage({ root: '${{ yaml("a.yaml") }}' });

    expect(message).toContain("Circular include");
    expect(message).toContain("a.yaml");
  });

  test("refuses to sit inside a longer string", async () => {
    writeFileSync(join(cwd, "competition.yaml"), "id: fit5047\n");

    const message = await failureMessage({
      name: 'the ${{ yaml("competition.yaml") }} competition',
    });

    expect(message).toContain("cannot sit inside a longer string");
  });

  test("ignores whitespace around a standalone template", async () => {
    writeFileSync(join(cwd, "competition.yaml"), "id: fit5047\n");

    const result = await runTransform({
      competition: '  ${{ yaml("competition.yaml") }}\n',
    });

    expect(result).toEqual({ competition: { id: "fit5047" } });
  });

  test("keeps a scalar document usable inside a longer string", async () => {
    writeFileSync(join(cwd, "name.yaml"), "FIT5047\n");

    const result = await runTransform({
      title: 'the ${{ yaml("name.yaml") }} competition',
    });

    expect(result).toEqual({ title: "the FIT5047 competition" });
  });
});

describe("parsing", () => {
  test("leaves strings without a call unchanged", async () => {
    const result = await runTransform({
      plain: "no interpolation",
      // A GitHub Actions expression, which an organiser may well be documenting
      // in a competition's rules.
      actions: "${{ secrets.GITHUB_TOKEN }}",
    });

    expect(result).toEqual({
      plain: "no interpolation",
      actions: "${{ secrets.GITHUB_TOKEN }}",
    });
  });

  test("leaves an unrecognised operator as written", async () => {
    const result = await runTransform({
      unsupported: '${{ secret("OPEN_COMPETITION_KIT_TEST_VALUE") }}',
      actions: '${{ hashFiles("**/bun.lock") }}',
    });

    expect(result).toEqual({
      unsupported: '${{ secret("OPEN_COMPETITION_KIT_TEST_VALUE") }}',
      actions: '${{ hashFiles("**/bun.lock") }}',
    });
  });

  test("accepts single quotes, escapes and brackets in a path", async () => {
    writeFileSync(join(cwd, "logo (1).txt"), "bracketed");
    writeFileSync(join(cwd, 'quote".txt'), "quoted");

    const result = await runTransform({
      brackets: "${{ text('logo (1).txt') }}",
      escaped: '${{ text("quote\\".txt") }}',
    });

    expect(result).toEqual({ brackets: "bracketed", escaped: "quoted" });
  });

  test("resolves several calls in one string", async () => {
    const result = await runTransform({
      line: '${{ text("included.txt") }} and ${{ env("OPEN_COMPETITION_KIT_TEST_VALUE") }}',
    });

    expect(result).toEqual({ line: "from-file and from-env" });
  });

  test("leaves non-string leaves alone, including dates", async () => {
    const date = new Date("2026-07-01T09:00:00Z");
    const result = await runTransform({
      opensAt: date,
      maxSubmissions: 20,
      draft: false,
      nothing: null,
    });

    expect(result).toEqual({
      opensAt: date,
      maxSubmissions: 20,
      draft: false,
      nothing: null,
    });
  });
});
