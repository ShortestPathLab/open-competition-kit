import { describe, expect, it } from "bun:test";
import { row, sumOf } from "./row";

describe("row", () => {
  it("keeps a flat object of scalars", () => {
    expect(row({ score: 4.5, name: "alpha", passed: true }, "evaluate()")).toEqual({
      score: 4.5,
      name: "alpha",
      passed: true,
    });
  });

  it("treats nothing as an empty row", () => {
    // A program that returns nothing has said "no scores", which is a legitimate
    // thing for a failed case to say.
    expect(row(null, "evaluate()")).toEqual({});
    expect(row(undefined, "evaluate()")).toEqual({});
  });

  it("refuses a nested object, and says which key", () => {
    // The quiet failure this exists to prevent: a board stringifies it into one
    // cell, ranks on nothing, and nobody is told.
    expect(() => row({ results: { q1: 1 } }, "reduce()")).toThrow(
      /results is an object/,
    );
  });

  it("refuses a list", () => {
    expect(() => row({ scores: [1, 2] }, "reduce()")).toThrow(/scores is a list/);
  });

  it("refuses something that is not an object at all", () => {
    expect(() => row(42, "evaluate()")).toThrow(/returned number/);
  });

  it("names every offending key at once", () => {
    expect(() => row({ a: {}, b: [], c: 1 }, "reduce()")).toThrow(
      /a is an object, b is a list/,
    );
  });

  it("refuses a score that is not finite", () => {
    // A division that went wrong arrives as null through JSON and ranks below
    // zero, which reads as a bad submission rather than as a bad program.
    expect(() => row({ score: Number.POSITIVE_INFINITY }, "reduce()")).toThrow(
      /score is Infinity/,
    );
    expect(() => row({ score: Number.NaN }, "reduce()")).toThrow(/score is NaN/);
  });

  it("drops a key that was explicitly undefined", () => {
    expect(row({ a: 1, b: undefined }, "evaluate()")).toEqual({ a: 1 });
  });

  it("names where the trouble was", () => {
    expect(() => row({ a: {} }, "evaluate() on case 3/40")).toThrow(
      /evaluate\(\) on case 3\/40/,
    );
  });
});

describe("sumOf", () => {
  it("adds the numbers across cases and counts them", () => {
    expect(sumOf([{ score: 1.5 }, { score: 2.5 }])).toEqual({
      score: 4,
      cases: 2,
    });
  });

  it("leaves booleans out", () => {
    // They add up as numbers in enough languages that `passed: true` on forty
    // cases would report `passed: 40`, which reads like a count of something.
    expect(sumOf([{ passed: true }, { passed: false }])).toEqual({ cases: 2 });
  });

  it("leaves strings out", () => {
    expect(sumOf([{ layout: "a", score: 1 }, { layout: "b", score: 2 }])).toEqual({
      score: 3,
      cases: 2,
    });
  });

  it("counts a case that scored nothing", () => {
    // A case whose container died contributes an empty row. It still happened,
    // so it still counts, and a total over four cases should not read as three.
    expect(sumOf([{ score: 1 }, {}, { score: 2 }])).toEqual({
      score: 3,
      cases: 3,
    });
  });

  it("answers for no cases at all", () => {
    expect(sumOf([])).toEqual({ cases: 0 });
  });
});
