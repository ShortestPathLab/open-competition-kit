import { describe, expect, test } from "bun:test";
import { _, chain, flow } from "./flow";

describe("chain", () => {
  test("threads a value through its functions left to right", () => {
    const result = chain(
      2,
      (x) => x + 1,
      (x) => x * 3,
    );
    expect(result).toBe(9);
  });

  test("returns the value untouched through a single function", () => {
    expect(chain("hi", (s) => s.toUpperCase())).toBe("HI");
  });

  test("passes the value by reference, not by copy", () => {
    const obj = { a: 1 };
    expect(chain(obj, (o) => o)).toBe(obj);
  });

  test("exposes `flow` and `_` as the same function", () => {
    expect(flow).toBe(chain);
    expect(_).toBe(chain);
  });
});
