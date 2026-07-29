import { describe, expect, it } from "vitest";
import {
  competitionSchedule,
  competitionWindow,
  splitRemaining,
  type TrackWindow,
} from "./competition-window";

const track = (id: string, opensAt?: string, closesAt?: string): TrackWindow => ({
  id,
  name: id === "main" ? "Main Track" : id,
  opensAt,
  closesAt,
});

const JAN = "2026-01-12T00:00:00.000Z";
const AUG = "2026-08-21T09:00:00.000Z";
const SEP = "2026-09-04T09:00:00.000Z";

const NOW = Date.parse("2026-07-29T00:00:00.000Z");

describe("competitionWindow", () => {
  it("takes the earliest opening and the latest closing", () => {
    expect(
      competitionWindow([track("a", JAN, AUG), track("b", AUG, SEP)]),
    ).toEqual({ opensAt: JAN, closesAt: SEP });
  });

  it("has no opening when one track never had one", () => {
    expect(
      competitionWindow([track("a", JAN, AUG), track("b", undefined, AUG)]),
    ).toEqual({ opensAt: undefined, closesAt: AUG });
  });

  it("has no closing when one track never closes", () => {
    expect(
      competitionWindow([track("a", JAN, AUG), track("b", JAN)]),
    ).toEqual({ opensAt: JAN, closesAt: undefined });
  });
});

describe("competitionSchedule", () => {
  it("renders nothing when no track schedules anything", () => {
    expect(competitionSchedule([track("a"), track("b")], NOW)).toBeUndefined();
  });

  it("counts down to the opening before the competition starts", () => {
    const schedule = competitionSchedule([track("a", AUG, SEP)], NOW);
    expect(schedule?.state.status).toBe("upcoming");
    expect(schedule?.countdown).toEqual({ label: "Opens in", at: AUG });
  });

  it("names the deadline when every track shares it", () => {
    const schedule = competitionSchedule(
      [track("a", JAN, AUG), track("b", JAN, AUG)],
      NOW,
    );
    expect(schedule?.countdown).toEqual({
      label: "Submissions close in",
      at: AUG,
    });
  });

  it("counts down to the nearest deadline, not the last", () => {
    const schedule = competitionSchedule(
      [track("a", JAN, AUG), track("b", JAN, SEP)],
      NOW,
    );
    expect(schedule?.countdown).toEqual({ label: "Next deadline in", at: AUG });
  });

  it("stops counting once every deadline has passed", () => {
    const after = Date.parse("2026-10-01T00:00:00.000Z");
    const schedule = competitionSchedule([track("a", JAN, AUG)], after);
    expect(schedule?.state.status).toBe("closed");
    expect(schedule?.countdown).toBeUndefined();
  });

  it("qualifies a bound that only some tracks share", () => {
    const schedule = competitionSchedule(
      [track("main", JAN, AUG), track("b", JAN, SEP)],
      NOW,
    );
    expect(schedule?.milestones.map((m) => [m.label, m.past])).toEqual([
      ["Opened", true],
      ["Main Track closes", false],
      ["b closes", false],
    ]);
  });

  it("orders milestones by date", () => {
    const schedule = competitionSchedule([track("a", JAN, AUG)], NOW);
    expect(schedule?.milestones.map((m) => m.at)).toEqual([JAN, AUG]);
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
