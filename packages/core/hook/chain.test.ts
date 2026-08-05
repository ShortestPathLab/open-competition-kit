import { describe, expect, test } from "bun:test";
import { Schema as S } from "effect";
import { assembleHooks } from "./chain";
import { componentSource, type Source } from "./component";
import { hook } from "./hook";

const Test = S.Struct({
  group: S.Struct({
    trace: hook<string, string[]>(),
    ui: componentSource<Record<string, never>>(),
  }),
  options: S.Struct({}),
});

type Trace = (input: string, next?: (input: string) => Promise<string[]>) => Promise<string[]>;

/** The additive shape every gate in `standard` is written in. */
const appends = (id: string) => ({
  group: {
    trace: (async (input, next) => [...((await next?.(input)) ?? []), id]) satisfies Trace,
  },
});

const assemble = (modules: readonly unknown[]) =>
  assembleHooks(modules, Test) as {
    group: {
      trace: Trace;
      ui: () => Promise<Source & { args: unknown[] }>;
    };
    options: Record<string, unknown>;
  };

describe("chained hooks", () => {
  // The last entry in `with:` is outermost, so it is asked first and the packages
  // it delegates to answer beneath it. An organiser reads their `with:` list top
  // to bottom as innermost to outermost.
  test("run from the last package listed to the first", async () => {
    const hooks = assemble([appends("a"), appends("b"), appends("c")]);
    expect(await hooks.group.trace("x")).toEqual(["a", "b", "c"]);
  });

  test("stop where an implementation declines to call next", async () => {
    const halts = { group: { trace: (async () => ["halted"]) satisfies Trace } };
    const hooks = assemble([appends("a"), halts, appends("c")]);
    expect(await hooks.group.trace("x")).toEqual(["halted", "c"]);
  });

  // `standard` terminates its gate chains with `?? all`, which only works because
  // the innermost link is called without a `next` to fall through to.
  test("leave the innermost link without a next", async () => {
    let received: unknown = "never called";
    const innermost = {
      group: {
        trace: (async (_input, next) => {
          received = next;
          return [];
        }) satisfies Trace,
      },
    };
    await assemble([innermost, appends("b")]).group.trace("x");
    expect(received).toBeUndefined();
  });

  test("call a lone implementation directly", async () => {
    const hooks = assemble([appends("only")]);
    expect(await hooks.group.trace("x")).toEqual(["only"]);
  });
});

describe("override hooks", () => {
  const emits = (id: string) => ({
    group: {
      ui: async (...args: unknown[]) => ({
        type: "open-competition-kit/hook/component-source" as const,
        source: id,
        args,
      }),
    },
  });

  // A componentSource takes no arguments, so a chain would hand the winner a
  // `next` it has no parameter for and could never call.
  test("take the last package listed and pass it no next", async () => {
    const result = await assemble([emits("a"), emits("b")]).group.ui();
    expect(result.source).toBe("b");
    expect(result.args).toEqual([]);
  });
});

describe("values that are not hooks", () => {
  test("merge, rather than being treated as implementations", () => {
    const hooks = assemble([
      { options: { fromA: 1, shared: "a" } },
      { options: { fromB: 2, shared: "b" } },
    ]);
    expect(hooks.options).toEqual({ fromA: 1, shared: "b", fromB: 2 });
  });

  // Nothing in `Hooks` is an array today. Interleaving two by index would produce
  // a list neither package wrote, which is worse than taking one of them.
  test("take the last array rather than merging element-wise", () => {
    const hooks = assembleHooks(
      [{ options: { list: [1, 2, 3] } }, { options: { list: [9] } }],
      Test,
    ) as { options: { list: number[] } };
    expect(hooks.options.list).toEqual([9]);
  });
});

describe("package metadata", () => {
  // `config` holds validation schemas, and a schema carries functions. Walked as
  // hooks they would be chained into each other.
  test("is left out rather than assembled", () => {
    const schema = { "~standard": { validate: () => ({ value: 1 }) } };
    const assembled = assembleHooks(
      [
        { name: "a", version: "1", config: { track: { schema } } },
        { name: "b", version: "2" },
      ],
      Test,
    );
    expect(assembled).toEqual({});
  });
});
