import { describe, expect, test } from "bun:test";
import { audienceOf, orderItems, region, std, type SurfaceNote } from "./surface";

const note = (id: string, weight?: number): SurfaceNote => ({
  kind: "note",
  id,
  weight,
  title: id,
});

describe("region ids", () => {
  test("are namespaced under the stem", () => {
    expect(std.competitionYou).toBe(
      "open-competition-kit/surface/competition/you",
    );
    expect(region("acme/thing")).toBe(
      "open-competition-kit/surface/acme/thing",
    );
  });
});

describe("audienceOf", () => {
  test("reads the dashboard as organiser-only", () => {
    expect(audienceOf(std.dashboardOverview)).toBe("organiser");
  });

  // A region nobody listed is a competitor's, which is also the safe default:
  // being wrong this way shows a competitor their own content, not somebody
  // else's.
  test("reads everything else as a competitor's", () => {
    expect(audienceOf(std.competitionYou)).toBe("participant");
    expect(audienceOf("open-competition-kit/surface/not/a/region")).toBe(
      "participant",
    );
  });
});

describe("orderItems", () => {
  test("sorts by weight, ascending", () => {
    const ordered = orderItems([note("c", 5), note("a", -1), note("b")]);
    expect(ordered.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  // Chain order runs from the last package listed in `with:` to the first, so a
  // package that states no weight has to stay where the chain put it. Sorting
  // that reshuffled equal weights would make the rail's order depend on nothing
  // an organiser can see.
  test("keeps chain order when weights tie", () => {
    const ordered = orderItems([note("first"), note("second"), note("third")]);
    expect(ordered.map((item) => item.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  test("keeps the first of two contributions sharing an id", () => {
    const ordered = orderItems([
      { kind: "note", id: "github/repository", title: "outer" },
      { kind: "note", id: "github/repository", title: "inner" },
    ]);
    expect(ordered).toHaveLength(1);
    expect(ordered[0]).toMatchObject({ title: "outer" });
  });

  // Deduplication runs before sorting, so a duplicate cannot smuggle in a weight
  // that changes where the survivor lands.
  test("does not let a dropped duplicate reorder the survivor", () => {
    const ordered = orderItems([
      note("a"),
      note("b", 10),
      { ...note("b", -10), title: "duplicate" },
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
