import { describe, expect, it } from "bun:test";
import type { Submission } from "@open-competition-kit/sdk";
import {
  attemptsGate,
  attemptsReport,
  rateGate,
  rateReport,
  windowGate,
  windowReport,
} from "./gates-impl";

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
  const mine = [submissionAt("2026-08-01T00:00:00Z"), submissionAt("2026-08-02T00:00:00Z")];

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
    const mine = [submissionAt("2026-08-01T11:30:00Z"), submissionAt("2026-08-01T11:45:00Z")];
    const [refusal] = rateGate({ rateLimit }, mine, now);
    expect(refusal?.gate).toBe("rate");
    expect(refusal?.detail).toMatchObject({ used: 2, count: 2 });
  });

  // The window slides, so the slot that frees up next belongs to the oldest
  // submission still inside it, not to the most recent one.
  it("points at when the oldest submission in the window ages out", () => {
    const mine = [submissionAt("2026-08-01T11:30:00Z"), submissionAt("2026-08-01T11:45:00Z")];
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

// ─── Reports ─────────────────────────────────────────────
//
// The other half of every gate: what it has to say when it is *not* refusing.
// Each of these has a matching refusal above, and the pair is the invariant
// worth holding on to — a gate that reports `blocked` and then lets a submission
// through, or refuses one while reporting `ok`, is the failure this shape exists
// to make visible.

describe("windowReport", () => {
  const track = {
    opensAt: "2026-08-01T00:00:00.000Z",
    closesAt: "2026-09-01T00:00:00.000Z",
  };

  // Silence rather than "always open". An empty list is how the host knows there
  // is no schedule to draw, and a row saying "Open" forever is noise in a table.
  it("says nothing about a track with no window", () => {
    expect(windowReport({}, at("2026-08-15T00:00:00Z"))).toEqual([]);
  });

  it("counts down to the opening before a track opens", () => {
    const [report] = windowReport(track, at("2026-07-31T23:59:59Z"));
    expect(report).toMatchObject({
      gate: "window",
      state: "blocked",
      at: track.opensAt,
      atLabel: "Opens",
    });
  });

  it("reports the deadline while the track is still open", () => {
    const [report] = windowReport(track, at("2026-08-02T00:00:00Z"));
    expect(report).toMatchObject({
      state: "ok",
      label: "Open",
      at: track.closesAt,
      atLabel: "Closes",
    });
  });

  // The one state the rules do not have. A track with two days left and one with
  // two months left are otherwise the same colour, and only one needs you today.
  it("asks for attention as the deadline approaches", () => {
    const soon = at("2026-08-30T00:00:00Z");
    expect(windowReport(track, soon)[0]).toMatchObject({
      state: "pending",
      label: "Closes soon",
    });
  });

  it("keeps reporting the date once the track has closed", () => {
    const [report] = windowReport(track, at("2026-09-02T00:00:00Z"));
    expect(report).toMatchObject({
      state: "blocked",
      at: track.closesAt,
      atLabel: "Closed",
    });
  });

  it("says a track with no deadline has none", () => {
    const [report] = windowReport({ opensAt: track.opensAt }, at("2026-08-15T00:00:00Z"));
    expect(report).toMatchObject({ state: "ok", detail: "No closing date." });
    expect(report).not.toHaveProperty("at");
  });

  it("agrees with the gate about whether the track is refusing", () => {
    for (const now of [
      at("2026-07-01T00:00:00Z"),
      at("2026-08-15T00:00:00Z"),
      at("2026-10-01T00:00:00Z"),
    ]) {
      const refused = windowGate(track, now).length > 0;
      const blocked = windowReport(track, now).some((report) => report.state === "blocked");
      expect(blocked).toBe(refused);
    }
  });
});

describe("attemptsReport", () => {
  const mine = [submissionAt("2026-08-01T00:00:00Z"), submissionAt("2026-08-02T00:00:00Z")];

  it("says nothing when no ceiling is configured", () => {
    expect(attemptsReport({}, mine, true)).toEqual([]);
  });

  it("counts down what is left", () => {
    expect(attemptsReport({ maxSubmissions: 5 }, mine, true)[0]).toMatchObject({
      state: "ok",
      label: "3 attempts left",
    });
  });

  it("asks for attention on the last attempt", () => {
    expect(attemptsReport({ maxSubmissions: 3 }, mine, true)[0]).toMatchObject({
      state: "pending",
      label: "1 attempt left",
    });
  });

  it("blocks once every attempt is spent", () => {
    expect(attemptsReport({ maxSubmissions: 2 }, mine, true)[0]).toMatchObject({
      state: "blocked",
      label: "No attempts left",
    });
  });

  // Asked without a signed-in reader, the ceiling is still worth stating: it is
  // a rule of the track rather than a fact about anybody in particular.
  it("states the rule rather than a total when nobody is asking", () => {
    const [report] = attemptsReport({ maxSubmissions: 3 }, [], false);
    expect(report).toMatchObject({ state: "ok", label: "3 submissions each" });
    expect(report?.data).toEqual({ max: 3 });
  });

  it("agrees with the gate about whether the competitor is refused", () => {
    for (const max of [1, 2, 3]) {
      const refused = attemptsGate({ maxSubmissions: max }, mine).length > 0;
      const blocked = attemptsReport({ maxSubmissions: max }, mine, true).some(
        (report) => report.state === "blocked",
      );
      expect(blocked).toBe(refused);
    }
  });
});

describe("rateReport", () => {
  const rateLimit = { count: 2, windowMinutes: 60 };
  const now = at("2026-08-01T12:00:00Z");

  it("says nothing when no limit is configured", () => {
    expect(rateReport({}, [], now, true)).toEqual([]);
  });

  it("states the rule while there is room in the window", () => {
    const mine = [submissionAt("2026-08-01T11:30:00Z")];
    expect(rateReport({ rateLimit }, mine, now, true)[0]).toMatchObject({
      state: "ok",
      label: "2 submissions every hour",
    });
  });

  it("points at the instant the next slot frees up", () => {
    const mine = [submissionAt("2026-08-01T11:30:00Z"), submissionAt("2026-08-01T11:45:00Z")];
    expect(rateReport({ rateLimit }, mine, now, true)[0]).toMatchObject({
      state: "blocked",
      at: "2026-08-01T12:30:00.000Z",
      atLabel: "Next attempt",
    });
  });

  it("agrees with the gate about whether the competitor is refused", () => {
    const full = [submissionAt("2026-08-01T11:30:00Z"), submissionAt("2026-08-01T11:45:00Z")];
    for (const mine of [[], full]) {
      const refused = rateGate({ rateLimit }, mine, now).length > 0;
      const blocked = rateReport({ rateLimit }, mine, now, true).some(
        (report) => report.state === "blocked",
      );
      expect(blocked).toBe(refused);
    }
  });
});
