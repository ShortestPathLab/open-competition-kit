import { describe, expect, it } from "bun:test";
import type { Submission } from "@open-competition-kit/sdk";
import { attemptsGate, rateGate, windowGate } from "./gates";

const at = (iso: string) => Date.parse(iso);

/** Only `createdAt` matters to these gates; the rest is scaffolding. */
const submissionAt = (iso: string): Submission =>
  ({
    _tag: "open-competition-kit/db/submission",
    id: iso,
    createdAt: new Date(iso),
    user: "u1",
    track: "t1",
    body: "{}",
  }) as Submission;

describe("windowGate", () => {
  const track = {
    opensAt: "2026-08-01T00:00:00.000Z",
    closesAt: "2026-09-01T00:00:00.000Z",
  };

  it("allows a track with no window at all", () => {
    expect(windowGate({}, at("2026-08-15T00:00:00Z"))).toEqual([]);
  });

  it("refuses before it opens, and says when it does", () => {
    const [refusal] = windowGate(track, at("2026-07-31T23:59:59Z"));
    expect(refusal?.gate).toBe("window");
    expect(refusal?.detail).toEqual({ opensAt: track.opensAt });
  });

  it("refuses from the closing instant onwards", () => {
    expect(windowGate(track, at("2026-08-31T23:59:59.999Z"))).toEqual([]);
    const [refusal] = windowGate(track, at("2026-09-01T00:00:00.000Z"));
    expect(refusal?.detail).toEqual({ closesAt: track.closesAt });
  });
});

describe("attemptsGate", () => {
  const mine = [
    submissionAt("2026-08-01T00:00:00Z"),
    submissionAt("2026-08-02T00:00:00Z"),
  ];

  it("allows when no ceiling is configured", () => {
    expect(attemptsGate({}, mine)).toEqual([]);
  });

  it("allows up to the ceiling and refuses on it", () => {
    expect(attemptsGate({ maxSubmissions: 3 }, mine)).toEqual([]);
    const [refusal] = attemptsGate({ maxSubmissions: 2 }, mine);
    expect(refusal?.gate).toBe("attempts");
    expect(refusal?.detail).toEqual({ used: 2, max: 2 });
  });

  it("counts every submission ever, not recent ones", () => {
    const old = [submissionAt("1999-01-01T00:00:00Z")];
    expect(attemptsGate({ maxSubmissions: 1 }, old)).toHaveLength(1);
  });

  it("reads naturally when only one attempt is allowed", () => {
    const [refusal] = attemptsGate({ maxSubmissions: 1 }, mine);
    expect(refusal?.reason).toBe("You have used all 1 submission for this track.");
  });
});

describe("rateGate", () => {
  const rateLimit = { count: 2, windowMinutes: 60 };
  const now = at("2026-08-01T12:00:00Z");

  it("allows when no limit is configured", () => {
    expect(rateGate({}, [submissionAt("2026-08-01T11:59:00Z")], now)).toEqual([]);
  });

  it("ignores submissions that have aged out of the window", () => {
    const mine = [
      submissionAt("2026-08-01T10:00:00Z"),
      submissionAt("2026-08-01T10:30:00Z"),
      submissionAt("2026-08-01T11:30:00Z"),
    ];
    expect(rateGate({ rateLimit }, mine, now)).toEqual([]);
  });

  it("refuses once the window is full", () => {
    const mine = [
      submissionAt("2026-08-01T11:30:00Z"),
      submissionAt("2026-08-01T11:45:00Z"),
    ];
    const [refusal] = rateGate({ rateLimit }, mine, now);
    expect(refusal?.gate).toBe("rate");
    expect(refusal?.detail).toMatchObject({ used: 2, count: 2 });
  });

  // The window slides, so the slot that frees up next belongs to the oldest
  // submission still inside it, not to the most recent one.
  it("points at when the oldest submission in the window ages out", () => {
    const mine = [
      submissionAt("2026-08-01T11:30:00Z"),
      submissionAt("2026-08-01T11:45:00Z"),
    ];
    const [refusal] = rateGate({ rateLimit }, mine, now);
    expect(refusal?.detail?.retryAt).toBe("2026-08-01T12:30:00.000Z");
  });

  // 11:00 exactly would have aged out: the trailing edge is exclusive, the same
  // way `closesAt` is.
  it("says hour and day rather than counting minutes", () => {
    const one = [submissionAt("2026-08-01T11:30:00Z")];
    const hour = rateGate({ rateLimit: { count: 1, windowMinutes: 60 } }, one, now);
    const day = rateGate({ rateLimit: { count: 1, windowMinutes: 1440 } }, one, now);
    expect(hour[0]?.reason).toContain("every hour");
    expect(day[0]?.reason).toContain("every day");
  });
});
