import { BunContext } from "@effect/platform-bun";
import { describe, expect, test } from "bun:test";
import { Effect as E } from "effect";
import { load } from "js-yaml";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decode, propagateExtendable, transform } from "./index";

describe("transform then decode", () => {
  test("resolves a competition written in its own file", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ock-config-"));
    mkdirSync(join(cwd, "competitions"));
    mkdirSync(join(cwd, "assets"));

    writeFileSync(join(cwd, "assets", "logo.svg"), "<svg/>");
    writeFileSync(join(cwd, "competitions", "rules.md"), "be nice");
    writeFileSync(
      join(cwd, "competitions", "fit5047.yaml"),
      [
        "id: fit5047",
        "with: []",
        'rules: ${{ text("rules.md") }}',
        "runner: { with: [] }",
        "leaderboards: []",
        "tracks:",
        "  - id: main",
        "    with: []",
        // Unquoted, so js-yaml hands back a Date. It has to reach the package
        // validators intact rather than as an empty object.
        "    opensAt: 2026-07-01T09:00:00+10:00",
        "    form: { with: [], shape: [] }",
      ].join("\n"),
    );

    const source = [
      "with: []",
      "appName: GPPC",
      "appDescription: A competition",
      "auth: {}",
      "db: {}",
      'logo: ${{ dataUrl("./assets/logo.svg") }}',
      "admins:",
      '  - ${{ env("OCK_ABSENT_ADMIN", "nobody@example.com") }}',
      "competitions:",
      '  - ${{ yaml("./competitions/fit5047.yaml") }}',
    ].join("\n");

    const config = (await E.runPromise(
      transform(cwd, load(source)).pipe(
        E.andThen(decode),
        E.provide(BunContext.layer),
      ),
    )) as Record<string, any>;

    // The whole point of the ordering: `competitions` is a list of strings until
    // the templates resolve, so the schema has to see it afterwards.
    expect(config.competitions).toHaveLength(1);
    expect(config.competitions[0].id).toBe("fit5047");
    expect(config.competitions[0].rules).toBe("be nice");
    expect(config.competitions[0].tracks[0].id).toBe("main");
    expect(config.competitions[0].tracks[0].opensAt).toBeInstanceOf(Date);
    expect(config.admins).toEqual(["nobody@example.com"]);
    expect(config.logo).toBe(
      `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`,
    );

    rmSync(cwd, { recursive: true, force: true });
  });

  test("inlines a competition's pictures and a track's off disk", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ock-config-"));
    mkdirSync(join(cwd, "assets"));

    writeFileSync(join(cwd, "assets", "icon.svg"), "<svg>icon</svg>");
    writeFileSync(join(cwd, "assets", "banner.svg"), "<svg>banner</svg>");
    writeFileSync(join(cwd, "assets", "track.svg"), "<svg>track</svg>");

    const source = [
      "with: []",
      "appName: GPPC",
      "appDescription: A competition",
      "auth: {}",
      "db: {}",
      "competitions:",
      "  - id: fit5047",
      "    with: []",
      '    icon: ${{ dataUrl("./assets/icon.svg") }}',
      '    banner: ${{ dataUrl("./assets/banner.svg") }}',
      "    runner: { with: [] }",
      "    leaderboards: []",
      "    tracks:",
      "      - id: main",
      "        with: []",
      '        icon: ${{ dataUrl("./assets/track.svg") }}',
      "        form: { with: [], shape: [] }",
    ].join("\n");

    const config = (await E.runPromise(
      transform(cwd, load(source)).pipe(
        E.andThen(decode),
        E.provide(BunContext.layer),
      ),
    )) as Record<string, any>;

    const inlined = (svg: string) =>
      `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

    // Three fields declared by core rather than by a package, so they survive
    // decoding rather than being preserved as excess properties.
    expect(config.competitions[0].icon).toBe(inlined("<svg>icon</svg>"));
    expect(config.competitions[0].banner).toBe(inlined("<svg>banner</svg>"));
    expect(config.competitions[0].tracks[0].icon).toBe(
      inlined("<svg>track</svg>"),
    );

    rmSync(cwd, { recursive: true, force: true });
  });
});

describe("decode", () => {
  test("fills in an absent `with`, so a node that installs nothing writes nothing", async () => {
    const source = [
      "appName: GPPC",
      "appDescription: A competition",
      "auth: {}",
      "db: {}",
      "competitions:",
      "  - id: fit5047",
      // Written with nothing under it, which js-yaml reads as null. Somebody who
      // left the key empty meant what somebody who left it out meant.
      "    with:",
      "    runner: {}",
      "    leaderboards: [{ id: board, shape: [] }]",
      "    tracks:",
      "      - id: main",
      "        form: { shape: [] }",
    ].join("\n");

    const config = (await E.runPromise(decode(load(source)))) as Record<
      string,
      any
    >;

    // Every extendable node still carries a list afterwards, so nothing reading
    // the decoded config has to ask whether the organiser wrote one.
    expect(config.with).toEqual([]);
    expect(config.competitions[0].with).toEqual([]);
    expect(config.competitions[0].runner.with).toEqual([]);
    expect(config.competitions[0].leaderboards[0].with).toEqual([]);
    expect(config.competitions[0].tracks[0].with).toEqual([]);
    expect(config.competitions[0].tracks[0].form.with).toEqual([]);
  });
});

describe("propagateExtendable", () => {
  test("flows a parent's packages down into nested collections, parent-first", () => {
    const result = propagateExtendable({
      with: ["root"],
      competitions: [
        {
          id: "alpha",
          with: ["alpha"],
          tracks: [{ id: "main", with: ["main"] }],
        },
      ],
    });

    // Each level keeps its own `with` last, so a track can override what its
    // competition and the root declared.
    expect(result.competitions[0]?.with).toEqual(["root", "alpha"]);
    expect(result.competitions[0]?.tracks[0]?.with).toEqual([
      "root",
      "alpha",
      "main",
    ]);
  });

  test("dedupes a package a child re-declares that an ancestor already had", () => {
    const result = propagateExtendable({
      with: ["a"],
      child: { with: ["a", "b"] },
    });

    expect(result.child.with).toEqual(["a", "b"]);
  });

  test("keeps siblings from inheriting each other's packages", () => {
    const result = propagateExtendable({
      with: ["root"],
      competitions: [
        { id: "alpha", with: ["alpha"] },
        { id: "beta", with: ["beta"] },
      ],
    });

    expect(result.competitions[0]?.with).toEqual(["root", "alpha"]);
    expect(result.competitions[1]?.with).toEqual(["root", "beta"]);
  });

  test("gives every object a `with`, even one that never declared packages", () => {
    // The dashboard and hooks resolve packages off `with`, so an object that
    // inherits from its parent but declares nothing must still carry the list.
    const result = propagateExtendable({ with: ["root"], auth: {} });

    expect((result.auth as { with: string[] }).with).toEqual(["root"]);
  });

  test("leaves primitives and null untouched", () => {
    const result = propagateExtendable({
      with: ["a"],
      nothing: null,
      text: "x",
      count: 3,
    });

    expect(result.nothing).toBeNull();
    expect(result.text).toBe("x");
    expect(result.count).toBe(3);
  });

  test("does not mutate the input", () => {
    const input = { with: ["root"], child: { with: ["child"] } };
    const snapshot = structuredClone(input);

    propagateExtendable(input);

    expect(input).toEqual(snapshot);
  });
});
