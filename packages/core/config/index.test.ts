import { describe, expect, test } from "bun:test";
import { propagateExtendable } from "./index";

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
