import { describe, expect, it } from "vitest";
import type { GateReport } from "@open-competition-kit/sdk/gate";
import {
  competitionSchedule,
  isActionable,
  phaseOf,
  splitRemaining,
  type TrackReports,
} from "./competition-window";

/**
 * The reports the `standard` package produces for a window, written out by hand.
 *
 * By hand on purpose: what this module has a contract with is `GateReport`, not
 * with any package that happens to produce one. A schedule built from a quota
 * that resets or a queue that drains should come out the same way, and writing
 * the reports here is the only way to say so.
 */
const opens = (at: string): GateReport => ({
  gate: "window",
  state: "blocked",
  label: "Upcoming",
  at,
  atLabel: "Opens",
});

const closes = (at: string, soon = false): GateReport => ({
  gate: "window",
  state: soon ? "pending" : "ok",
  label: soon ? "Closes soon" : "Open",
  at,
  atLabel: "Closes",
});

const closed = (at: string): GateReport => ({
  gate: "window",
  state: "blocked",
  label: "Closed",
  at,
  atLabel: "Closed",
});

const track = (id: string, ...reports: GateReport[]): TrackReports => ({
  id,
  name: id === "main" ? "Main Track" : id,
  reports,
});

const AUG = "2026-08-21T09:00:00.000Z";
const SEP = "2026-09-04T09:00:00.000Z";

const NOW = Date.parse("2026-07-29T00:00:00.000Z");

describe("phaseOf", () => {
  it("reads a track nothing has reported on as open", () => {
    expect(phaseOf([], NOW)).toBe("open");
  });

  it("reads a gate wanting attention as closing", () => {
    expect(phaseOf([closes(AUG, true)], NOW)).toBe("closing");
  });

  // The generalisation that replaced "upcoming versus closed". A blocked gate
  // with something still ahead of it is waiting; one with nothing ahead is done.
  // That is true of an opening date, and equally true of a quota that resets.
  it("splits a blocked gate by whether anything is still ahead", () => {
    expect(phaseOf([opens(AUG)], NOW)).toBe("upcoming");
    expect(phaseOf([closed(AUG)], Date.parse("2026-10-01T00:00:00.000Z"))).toBe(
      "closed",
    );
  });

  it("takes the worst thing any gate has to say", () => {
    const reports = [closes(SEP), { ...closes(AUG), state: "blocked" as const }];
    expect(phaseOf(reports, NOW)).toBe("upcoming");
  });

  it("treats open and closing alike as actionable", () => {
    expect(isActionable("open")).toBe(true);
    expect(isActionable("closing")).toBe(true);
    expect(isActionable("upcoming")).toBe(false);
    expect(isActionable("closed")).toBe(false);
  });
});

describe("competitionSchedule", () => {
  it("renders nothing when no track reports a date", () => {
    expect(competitionSchedule([track("a"), track("b")], NOW)).toBeUndefined();
  });

  it("counts down to the opening before the competition starts", () => {
    const schedule = competitionSchedule([track("a", opens(AUG))], NOW);
    expect(schedule?.status).toBe("upcoming");
    expect(schedule?.countdown).toEqual({ label: "Opens in", at: AUG });
  });

  it("names the deadline when every track shares it", () => {
    const schedule = competitionSchedule(
      [track("a", closes(AUG)), track("b", closes(AUG))],
      NOW,
    );
    expect(schedule?.countdown).toEqual({ label: "Closes in", at: AUG });
  });

  it("counts down to the nearest deadline, not the last", () => {
    const schedule = competitionSchedule(
      [track("a", closes(AUG)), track("b", closes(SEP))],
      NOW,
    );
    expect(schedule?.countdown).toEqual({ label: "Next deadline in", at: AUG });
  });

  it("stops counting once every deadline has passed", () => {
    const after = Date.parse("2026-10-01T00:00:00.000Z");
    const schedule = competitionSchedule([track("a", closed(AUG))], after);
    expect(schedule?.status).toBe("closed");
    expect(schedule?.countdown).toBeUndefined();
  });

  // The rule that used to say a competition-level bound counts only when every
  // track sets one, restated over states. A track still taking work keeps the
  // competition open however many of its siblings have finished.
  it("stays open while any one track is", () => {
    const after = Date.parse("2026-10-01T00:00:00.000Z");
    const schedule = competitionSchedule(
      [track("a", closed(AUG)), track("b", closes("2027-01-01T00:00:00.000Z"))],
      after,
    );
    expect(schedule?.status).toBe("open");
  });

  it("qualifies a date that only some tracks share", () => {
    const schedule = competitionSchedule(
      [track("main", closes(AUG)), track("b", closes(SEP))],
      NOW,
    );
    expect(schedule?.milestones.map((m) => [m.label, m.past])).toEqual([
      ["Main Track closes", false],
      ["b closes", false],
    ]);
  });

  it("leaves a shared date unqualified", () => {
    const schedule = competitionSchedule(
      [track("main", closes(AUG)), track("b", closes(AUG))],
      NOW,
    );
    expect(schedule?.milestones.map((m) => m.label)).toEqual(["Closes"]);
  });

  // Two tracks closing at the same moment is one date; a track closing exactly
  // when another opens is two, because they are different events.
  it("keeps dates from different gates apart", () => {
    const schedule = competitionSchedule(
      [track("a", opens(AUG)), track("b", closes(AUG))],
      NOW,
    );
    expect(schedule?.milestones).toHaveLength(2);
  });

  it("orders milestones by date", () => {
    const schedule = competitionSchedule(
      [track("a", closes(SEP)), track("b", opens(AUG))],
      NOW,
    );
    expect(schedule?.milestones.map((m) => m.at)).toEqual([AUG, SEP]);
  });

  it("marks a date that has already passed", () => {
    const after = Date.parse("2026-10-01T00:00:00.000Z");
    const schedule = competitionSchedule([track("a", closed(AUG))], after);
    expect(schedule?.milestones[0]).toMatchObject({ label: "Closed", past: true });
  });

  // Nothing here knows what a window is, so a package that reports something
  // else entirely gets the same countdown and the same rows.
  it("builds a schedule out of a gate that is not a window at all", () => {
    const quota: GateReport = {
      gate: "rate",
      state: "blocked",
      label: "Rate limited",
      at: AUG,
      atLabel: "Next attempt",
    };

    const schedule = competitionSchedule([track("a", quota)], NOW);
    expect(schedule?.countdown).toEqual({ label: "Next attempt in", at: AUG });
    expect(schedule?.milestones.map((m) => m.label)).toEqual(["Next attempt"]);
  });
});

describe("splitRemaining", () => {
  it("breaks a duration into days, hours, minutes and seconds", () => {
    const ms = ((24 * 24 + 6) * 60 + 18) * 60_000 + 42_000;
    expect(splitRemaining(ms)).toEqual({
      days: 24,
      hours: 6,
      minutes: 18,
      seconds: 42,
    });
  });

  it("floors at zero rather than running negative", () => {
    expect(splitRemaining(-5_000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });
});
