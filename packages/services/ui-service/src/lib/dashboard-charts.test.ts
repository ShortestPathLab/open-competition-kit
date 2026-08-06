import { describe, expect, it } from "vitest";
import { bestScores, byDay, histogram, MAX_DAYS } from "./dashboard-charts";
import type { ActivityRow } from "./dashboard-data";

const row = (partial: Partial<ActivityRow>): ActivityRow => ({
  id: "s1",
  number: 1,
  user: "a@example.com",
  userName: "A",
  trackId: "main",
  trackName: "Main",
  body: "{}",
  submittedAt: "2026-08-01T10:00:00.000Z",
  runs: 1,
  status: "done",
  result: null,
  ...partial,
});

describe("byDay", () => {
  it("has nothing to draw before anybody submits", () => {
    expect(byDay([])).toEqual([]);
  });

  it("keeps the quiet days between two busy ones", () => {
    const points = byDay([
      row({ id: "1", submittedAt: "2026-08-01T01:00:00.000Z" }),
      row({ id: "2", submittedAt: "2026-08-01T23:00:00.000Z" }),
      row({ id: "3", submittedAt: "2026-08-04T09:00:00.000Z" }),
    ]);

    expect(points.map((point) => [point.day, point.submissions])).toEqual([
      ["2026-08-01", 2],
      ["2026-08-02", 0],
      ["2026-08-03", 0],
      ["2026-08-04", 1],
    ]);
  });

  it("buckets by UTC rather than by the reader's day", () => {
    // 23:30Z on the 1st is the 2nd in Sydney and the 1st in London. Whichever
    // way it renders, it has to render the same on the server and the client.
    const points = byDay([row({ submittedAt: "2026-08-01T23:30:00.000Z" })]);
    expect(points).toEqual([{ day: "2026-08-01", label: "1 Aug", submissions: 1 }]);
  });

  it("skips a submission with no recorded instant", () => {
    expect(byDay([row({ submittedAt: null })])).toEqual([]);
  });

  it("windows to the most recent stretch rather than back to a stale pilot", () => {
    const points = byDay([
      row({ id: "old", submittedAt: "2020-01-01T00:00:00.000Z" }),
      row({ id: "new", submittedAt: "2026-08-04T00:00:00.000Z" }),
    ]);

    expect(points).toHaveLength(MAX_DAYS);
    expect(points.at(-1)).toMatchObject({ day: "2026-08-04", submissions: 1 });
    // The 2020 row is outside the window, so its count is not smuggled into the
    // first bar of it.
    expect(points[0]).toMatchObject({ submissions: 0 });
  });
});

describe("bestScores", () => {
  it("keeps one figure per competitor, their best", () => {
    expect(
      bestScores([
        row({ id: "1", user: "a@example.com", result: { total: 4 } }),
        row({ id: "2", user: "a@example.com", result: { total: 9 } }),
        row({ id: "3", user: "b@example.com", result: { total: 6 } }),
      ]).sort(),
    ).toEqual([6, 9]);
  });

  it("ignores a run that wrote no headline number", () => {
    expect(bestScores([row({ result: null }), row({ id: "2", result: { status: "ok" } })])).toEqual(
      [],
    );
  });
});

describe("histogram", () => {
  it("draws nothing when nothing is scored", () => {
    expect(histogram([])).toEqual([]);
  });

  it("puts a field that all scored the same into one bin", () => {
    expect(histogram([7, 7, 7])).toEqual([{ label: "7", competitors: 3 }]);
  });

  it("counts every competitor exactly once, top score included", () => {
    const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bins = histogram(scores);

    expect(bins.reduce((total, bin) => total + bin.competitors, 0)).toBe(scores.length);
    // The maximum lands in the last bin rather than in one past the end, which
    // is the bug an off-by-one here would produce and a chart would still draw.
    expect(bins.at(-1)?.competitors).toBeGreaterThan(0);
  });

  it("separates a bunched field from a spread one", () => {
    const bunched = histogram([9, 9.1, 9.2, 9.3, 9.4, 10]);
    const spread = histogram([0, 2, 4, 6, 8, 10]);

    const occupied = (bins: { competitors: number }[]) =>
      bins.filter((bin) => bin.competitors > 0).length;

    expect(occupied(bunched)).toBeLessThan(occupied(spread));
  });
});
