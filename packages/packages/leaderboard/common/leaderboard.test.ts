import { describe, expect, it } from "bun:test";
import { rank, select, toRows, type Row } from "./leaderboard";

const shape = [{ id: "rank" }, { id: "user" }, { id: "score" }];

describe("toRows", () => {
  it("reads a JSON-stringified object, which is how `standard` stores outputs", () => {
    expect(toRows(JSON.stringify({ score: 91, passed: true }))).toEqual([
      { score: 91, passed: true },
    ]);
  });

  it("splits an array output into one row per entry", () => {
    const output = JSON.stringify([
      { case: "a", score: 1 },
      { case: "b", score: 2 },
    ]);
    expect(toRows(output)).toEqual([
      { case: "a", score: 1 },
      { case: "b", score: 2 },
    ]);
  });

  it("wraps a bare scalar so a runner can just emit a number", () => {
    expect(toRows(42)).toEqual([{ value: 42 }]);
    expect(toRows(JSON.stringify(42))).toEqual([{ value: 42 }]);
  });

  it("keeps a non-JSON string rather than dropping it", () => {
    expect(toRows("timed out")).toEqual([{ value: "timed out" }]);
  });

  it("stringifies nested values instead of silently losing them", () => {
    expect(toRows({ score: 5, detail: { a: 1 } })).toEqual([{ score: 5, detail: '{"a":1}' }]);
  });

  it("treats absent output as no rows at all", () => {
    expect(toRows(null)).toEqual([]);
    expect(toRows(undefined)).toEqual([]);
  });
});

describe("select", () => {
  const rows: Row[] = [
    { userId: "u1", user: "ada", score: 70, job: "j1", ranAt: "2026-01-01" },
    { userId: "u1", user: "ada", score: 95, job: "j2", ranAt: "2026-01-02" },
    { userId: "u2", user: "grace", score: 80, job: "j3", ranAt: "2026-01-03" },
  ];

  it("keeps each competitor's best score, not their most recent", () => {
    const picked = select(rows, { rank: { field: "score", order: "desc" } });
    expect(picked).toHaveLength(2);
    expect(picked.find((r) => r.userId === "u1")?.score).toBe(95);
  });

  it("honours ascending rank, where lower wins (e.g. elapsed time)", () => {
    const picked = select(rows, { rank: { field: "score", order: "asc" } });
    expect(picked.find((r) => r.userId === "u1")?.score).toBe(70);
  });

  it("picks the latest run when asked, regardless of score", () => {
    const picked = select(rows, {
      select: "latest",
      rank: { field: "score", order: "desc" },
    });
    expect(picked.find((r) => r.userId === "u1")?.job).toBe("j2");
  });

  it("groups by submission when told to", () => {
    const perJob = select(rows, { groupBy: "job" });
    expect(perJob).toHaveLength(3);
  });

  it("leaves every row alone when grouping is off", () => {
    expect(select(rows, { groupBy: "none" })).toHaveLength(3);
  });
});

describe("rank", () => {
  const winners: Row[] = [
    { user: "ada", score: 80 },
    { user: "grace", score: 95 },
    { user: "alan", score: 88 },
  ];

  it("orders by the ranked field and numbers the rows", () => {
    const ranked = rank(winners, { rank: { field: "score" } }, shape);
    expect(ranked.map((r) => r.user)).toEqual(["grace", "alan", "ada"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("compares numerically, not lexically", () => {
    const ranked = rank([{ score: 9 }, { score: 100 }], { rank: { field: "score" } }, shape);
    expect(ranked[0]?.score).toBe(100);
  });

  it("applies limit after ordering, so the top N are the real top N", () => {
    const ranked = rank(winners, { rank: { field: "score" }, limit: 2 }, shape);
    expect(ranked.map((r) => r.user)).toEqual(["grace", "alan"]);
  });

  it("does not invent a rank column the board never asked for", () => {
    const ranked = rank(winners, { rank: { field: "score" } }, [{ id: "score" }]);
    expect(ranked[0]?.rank).toBeUndefined();
  });

  it("leaves a runner-supplied rank untouched", () => {
    const ranked = rank([{ user: "ada", score: 80, rank: 7 }], { rank: { field: "score" } }, shape);
    expect(ranked[0]?.rank).toBe(7);
  });
});
