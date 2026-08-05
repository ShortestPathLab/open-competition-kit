import { describe, expect, test } from "bun:test";
import { Effect as E, Schema as S } from "effect";
import { describeConfig } from "./describe";
import type { ConfigExtensions } from "./extension";
import { validateConfig } from "./validate";
import { walkNodes } from "./walk";

/**
 * A schema library core does not use, standing in for the ones packages do.
 *
 * The whole point of taking a Standard Schema is that core validates without
 * knowing which library produced the schema, so the tests use a hand-written
 * implementation of the interface rather than importing Zod. If this passes, so
 * does anything that publishes `~standard`.
 */
const object = <T extends Record<string, "string" | "number">>(
  fields: T,
  refine?: (value: Record<string, unknown>) => string | undefined,
) => ({
  "~standard": {
    version: 1 as const,
    vendor: "test",
    validate: (input: unknown) => {
      const value: Record<string, unknown> = {};
      const issues: { message: string; path: string[] }[] = [];

      for (const [key, kind] of Object.entries(fields)) {
        const raw = (input as Record<string, unknown>)?.[key];
        if (raw === undefined) continue;
        if (typeof raw !== kind) {
          issues.push({ message: `expected a ${kind}`, path: [key] });
          continue;
        }
        value[key] = raw;
      }

      const refused = refine?.(value);
      if (refused) issues.push({ message: refused, path: [] });

      return issues.length ? { issues } : { value };
    },
  },
});

/** A schema that rewrites what it accepts, to prove coercion is kept. */
const upper = {
  "~standard": {
    version: 1 as const,
    vendor: "test",
    validate: (input: unknown) => {
      const raw = (input as { shout?: unknown })?.shout;
      if (raw === undefined) return { value: {} };
      if (typeof raw !== "string") {
        return { issues: [{ message: "expected a string", path: ["shout"] }] };
      }
      return { value: { shout: raw.toUpperCase() } };
    },
  },
};

const pkg = (config: ConfigExtensions) => ({ config });

const resolverFor = (modules: Record<string, unknown>) => (specifier: string) =>
  specifier in modules
    ? E.succeed(modules[specifier])
    : E.fail(new Error(`no such package: ${specifier}`));

const base = () => ({
  appName: "Kit",
  appDescription: "",
  auth: {},
  db: {},
  with: ["gates"],
  competitions: [
    {
      id: "c1",
      with: [],
      tracks: [{ id: "t1", with: [], form: { with: [], shape: [] } }],
      runner: { with: [] },
      leaderboards: [],
    },
  ],
});

const run = <A, X>(effect: E.Effect<A, X>) => E.runPromise(E.either(effect));

describe("walkNodes", () => {
  test("finds every extendable node and inherits `with` downward", () => {
    const nodes = [...walkNodes(base() as never)];
    const paths = nodes.map((node) => node.path);

    expect(paths).toContain("config");
    expect(paths).toContain("config.db");
    expect(paths).toContain("config.competitions.c1");
    expect(paths).toContain("config.competitions.c1.tracks.t1");
    expect(paths).toContain("config.competitions.c1.tracks.t1.form");
    expect(paths).toContain("config.competitions.c1.runner");

    // The root installed `gates`, so every node below it has `gates` installed
    // too. This is the rule that lets a track be validated against the packages
    // its competition brought in.
    for (const node of nodes) expect(node.installed).toContain("gates");
  });

  test("names a node by its id rather than its index", () => {
    const paths = [...walkNodes(base() as never)].map((node) => node.path);
    expect(paths).not.toContain("config.competitions.0");
  });
});

describe("validateConfig", () => {
  const gates = pkg({
    track: { schema: object({ opensAt: "string", maxSubmissions: "number" }) },
  });

  test("accepts a field an installed package declares", async () => {
    const config = base();
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      maxSubmissions: 3,
    } as never;

    const result = await run(validateConfig(config as never, { resolve: resolverFor({ gates }) }));

    expect(result._tag).toBe("Right");
  });

  // The reason strict mode exists. Before packages could declare fields, a
  // misspelled `closesAt` was preserved and ignored, and the track simply never
  // closed with nothing anywhere to say why.
  test("rejects a field no installed package declares", async () => {
    const config = base();
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      closesat: "2026-09-01T00:00:00Z",
    } as never;

    const result = await run(validateConfig(config as never, { resolve: resolverFor({ gates }) }));

    expect(result._tag).toBe("Left");
    const message = String((result as { left: unknown }).left);
    expect(message).toContain("closesat");
    expect(message).toContain("config.competitions.c1.tracks.t1");
    // Naming who was asked is what turns "unrecognised field" into something an
    // organiser can act on: install a package, or fix the spelling.
    expect(message).toContain("gates");
  });

  test("passes an undeclared field through when strict is off", async () => {
    const config = base();
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      closesat: "whenever",
    } as never;

    const result = await run(
      validateConfig(config as never, {
        resolve: resolverFor({ gates }),
        strict: false,
      }),
    );

    expect(result._tag).toBe("Right");
  });

  test("rejects a declared field of the wrong type", async () => {
    const config = base();
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      maxSubmissions: "three",
    } as never;

    const result = await run(validateConfig(config as never, { resolve: resolverFor({ gates }) }));

    expect(result._tag).toBe("Left");
    expect(String((result as { left: unknown }).left)).toContain("maxSubmissions");
  });

  test("reports a cross-field rule at the node that broke it", async () => {
    const windows = pkg({
      track: {
        schema: object({ opensAt: "string", closesAt: "string" }, (value) =>
          value.opensAt && value.closesAt && value.closesAt <= value.opensAt
            ? "closesAt must be after opensAt"
            : undefined,
        ),
      },
    });

    const config = base();
    config.with = ["windows"];
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      opensAt: "2026-09-01",
      closesAt: "2026-08-01",
    } as never;

    const result = await run(
      validateConfig(config as never, { resolve: resolverFor({ windows }) }),
    );

    expect(result._tag).toBe("Left");
    expect(String((result as { left: unknown }).left)).toContain("closesAt must be after opensAt");
  });

  // A package that normalises has to have its work kept, or the normalisation is
  // decorative. `standard` relies on exactly this to turn the `Date` js-yaml
  // produces into a string before `propagateExtendable` can spread it away.
  test("writes a coerced value back into the config", async () => {
    const shouty = pkg({ track: { schema: upper } });

    const config = base();
    config.with = ["shouty"];
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      shout: "hello",
    } as never;

    const result = await run(validateConfig(config as never, { resolve: resolverFor({ shouty }) }));

    expect(result).toMatchObject({
      right: {
        competitions: [{ tracks: [{ shout: "HELLO" }] }],
      },
    });
  });

  test("leaves the caller's own object untouched", async () => {
    const shouty = pkg({ track: { schema: upper } });

    const config = base();
    config.with = ["shouty"];
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      shout: "hello",
    } as never;

    await run(validateConfig(config as never, { resolve: resolverFor({ shouty }) }));

    expect((config.competitions[0]!.tracks[0] as unknown as { shout: string }).shout).toBe("hello");
  });

  // Two packages declaring the same field is a declaration contributed twice, not
  // a dispute. A leaderboard renderer that ships the loader it needs declares the
  // loader's fields with it, so installing two renderers does exactly this.
  test("lets two packages declare the same field when they agree", async () => {
    const one = pkg({ track: { schema: object({ deadline: "string" }) } });
    const two = pkg({ track: { schema: object({ deadline: "string" }) } });

    const config = base();
    config.with = ["one", "two"];
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      deadline: "2026-09-01",
    } as never;

    const result = await run(
      validateConfig(config as never, { resolve: resolverFor({ one, two }) }),
    );

    expect(result._tag).toBe("Right");
  });

  // A field name is expected to have one definition. Two that normalise it
  // differently have two, and whichever ran last would win silently, leaving the
  // other package reading a value it never agreed to.
  test("refuses two packages that disagree about what a field becomes", async () => {
    const asIs = pkg({ track: { schema: object({ deadline: "string" }) } });
    const shouty = pkg({
      track: {
        schema: {
          "~standard": {
            version: 1 as const,
            vendor: "test",
            validate: (input: unknown) => {
              const node = input as { deadline?: string };
              return {
                value: node.deadline === undefined ? {} : { deadline: node.deadline.toUpperCase() },
              };
            },
          },
        },
      },
    });

    const config = base();
    config.with = ["asIs", "shouty"];
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      deadline: "2026-09-01t00:00:00z",
    } as never;

    const result = await run(
      validateConfig(config as never, { resolve: resolverFor({ asIs, shouty }) }),
    );

    expect(result._tag).toBe("Left");
    const message = String((result as { left: unknown }).left);
    expect(message).toContain("do not agree");
    expect(message).toContain("asIs");
    expect(message).toContain("shouty");
  });

  // A package installed on one track does not license a field on another. This
  // is what makes the `with:` list mean something rather than being advisory.
  test("a package installed deeper does not license a field above it", async () => {
    const config = base();
    config.with = [];
    config.competitions[0]!.tracks[0]!.with = ["gates"] as never;
    (config.competitions[0] as unknown as Record<string, unknown>).maxSubmissions = 3;

    const result = await run(validateConfig(config as never, { resolve: resolverFor({ gates }) }));

    expect(result._tag).toBe("Left");
    expect(String((result as { left: unknown }).left)).toContain("config.competitions.c1");
  });

  // A broken integration should not be able to stop a competition from booting.
  // The resolver already logs the import failure; this only decides what happens
  // next, and taking the whole config down would be the wrong answer.
  test("a package that fails to import contributes nothing and does not throw", async () => {
    const config = base();

    const result = await run(validateConfig(config as never, { resolve: resolverFor({}) }));

    expect(result._tag).toBe("Right");
  });

  test("`with` is never treated as an unrecognised field", async () => {
    const result = await run(validateConfig(base() as never, { resolve: resolverFor({ gates }) }));
    expect(result._tag).toBe("Right");
  });

  test("core's own fields are not mistaken for a package's", async () => {
    // Nothing is installed at all, so if core's fields were not exempt every
    // config in existence would fail to boot.
    const config = base();
    config.with = [];

    const result = await run(validateConfig(config as never, { resolve: resolverFor({}) }));

    expect(result._tag).toBe("Right");
  });
});

describe("describeConfig", () => {
  const gates = pkg({
    track: {
      schema: object({ maxSubmissions: "number" }),
      group: { id: "gates", label: "Submission gates" },
      shape: [
        {
          id: "maxSubmissions",
          label: "Total attempts",
          kind: "number",
          description: "How many submissions one competitor may make.",
        },
      ],
    },
  });

  test("carries the package's own labels and the config's current value", async () => {
    const config = base();
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      maxSubmissions: 20,
    } as never;

    const result = await run(describeConfig(config as never, resolverFor({ gates })));

    const track = (result as { right: Array<{ path: string }> }).right.find(
      (node) => node.path === "config.competitions.c1.tracks.t1",
    ) as never as {
      sections: Array<{
        source: string;
        group?: { label: string };
        fields: Array<{ id: string; label?: string; value?: unknown }>;
      }>;
    };

    expect(track.sections).toHaveLength(1);
    expect(track.sections[0]!.source).toBe("gates");
    expect(track.sections[0]!.group?.label).toBe("Submission gates");
    expect(track.sections[0]!.fields[0]).toMatchObject({
      id: "maxSubmissions",
      label: "Total attempts",
      value: 20,
    });
  });

  // A field the organiser never set still has to appear, or an editor has no
  // way to offer it. It just has no value yet.
  test("describes a declared field the config does not set", async () => {
    const result = await run(describeConfig(base() as never, resolverFor({ gates })));

    const track = (result as { right: Array<{ path: string; sections: unknown[] }> }).right.find(
      (node) => node.path === "config.competitions.c1.tracks.t1",
    )!;

    // No `shape` field matched a value, so nothing is claimed and the section
    // still lists what could be set.
    expect(track.sections).toHaveLength(1);
    expect(
      (track.sections[0] as { fields: Array<{ value?: unknown }> }).fields[0],
    ).not.toHaveProperty("value");
  });

  test("falls back to the schema's own field names without a shape", async () => {
    const bare = pkg({ track: { schema: object({ maxSubmissions: "number" }) } });

    const config = base();
    config.with = ["bare"];
    config.competitions[0]!.tracks[0]! = {
      ...config.competitions[0]!.tracks[0]!,
      maxSubmissions: 5,
    } as never;

    const result = await run(describeConfig(config as never, resolverFor({ bare })));

    const track = (result as { right: Array<{ path: string; sections: unknown[] }> }).right.find(
      (node) => node.path === "config.competitions.c1.tracks.t1",
    )!;

    expect((track.sections[0] as { fields: Array<{ id: string }> }).fields).toEqual([
      { id: "maxSubmissions", value: 5 } as never,
    ]);
  });
});

describe("Config", () => {
  // Core no longer declares any of these. Each one now belongs to whichever
  // package the organiser installed, which is what the tests above are checking
  // the machinery for.
  test("no longer declares the gate fields", () => {
    const { TrackConfig } = require("./schema") as {
      TrackConfig: typeof S.Struct extends never ? never : { fields: object };
    };
    const keys = Object.keys(TrackConfig.fields);
    expect(keys).not.toContain("opensAt");
    expect(keys).not.toContain("closesAt");
    expect(keys).not.toContain("maxSubmissions");
    expect(keys).not.toContain("rateLimit");
  });
});
