import { describe, expect, test } from "bun:test";
import { traverse } from "./traverse";

describe("traverse", () => {
  test("returns a structurally equal — but freshly built — copy for identity", () => {
    const input = { a: 1, b: [2, { c: 3 }] };
    const output = traverse(input, (v) => v);

    expect(output).toEqual(input);
    expect(output).not.toBe(input);
    expect(output.b).not.toBe(input.b);
  });

  test("visits parents before their children, top-down", () => {
    const seen: unknown[] = [];
    traverse({ a: 1, b: [2] }, (v) => {
      seen.push(v);
      return v;
    });

    // The root object is seen before its members; the array before its entries.
    expect(seen[0]).toEqual({ a: 1, b: [2] });
    expect(seen).toContainEqual([2]);
  });

  test("reports the path to each node, using indices for arrays", () => {
    const paths: Array<Array<string | number>> = [];
    traverse({ a: 1, b: [2, 3] }, (_v, path) => {
      paths.push([...path]);
      return _v;
    });

    expect(paths).toEqual([[], ["a"], ["b"], ["b", 0], ["b", 1]]);
  });

  test("recurses into whatever the callback returns, not the original", () => {
    // A callback that replaces a subtree must have that replacement traversed,
    // so a transform applied at one node still reaches the nodes beneath it.
    const output = traverse<Record<string, unknown>>(
      { a: { keep: 1 } },
      (v, path) => (path.length === 1 ? { replaced: 2 } : v),
    );

    expect(output).toEqual({ a: { replaced: 2 } });
  });

  test("composes a transform through every level of the tree", () => {
    const output = traverse({ a: 1, b: [2, 3] }, (v) =>
      typeof v === "number" ? v * 2 : v,
    );

    expect(output).toEqual({ a: 2, b: [4, 6] });
  });

  test("treats null as a leaf rather than descending into it", () => {
    const output = traverse({ a: null }, (v) => v);
    expect(output).toEqual({ a: null });
  });

  test("treats a function as a leaf — the property collections.ts depends on", () => {
    // collections.ts walks the db object and wraps only the function leaves; if
    // traverse descended into functions this would break.
    const fn = () => "raw";
    const output = traverse({ handler: fn }, (v) =>
      typeof v === "function" ? () => "wrapped" : v,
    );

    expect(output.handler()).toBe("wrapped");
  });

  test("applies the callback to a bare primitive at the root", () => {
    expect(traverse(2 as number, (v) => (v as number) * 5)).toBe(10);
  });
});
