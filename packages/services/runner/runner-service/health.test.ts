import { describe, expect, it } from "bun:test";
import { portFrom, reportOn } from "./health";

const TOLERANCE = 30_000;

describe("portFrom", () => {
  it("defaults when unset or blank", () => {
    expect(portFrom(undefined)).toBe(3001);
    expect(portFrom("  ")).toBe(3001);
  });

  it("takes a port", () => {
    expect(portFrom("8080")).toBe(8080);
    expect(portFrom("65535")).toBe(65535);
  });

  it("treats 0 and off as a deliberate no", () => {
    // A deployment that does not want a listening socket needs a way to say so
    // that is not "pick a port nobody routes to".
    expect(portFrom("0")).toBeUndefined();
    expect(portFrom("off")).toBeUndefined();
    expect(portFrom("OFF")).toBeUndefined();
  });

  it("falls back rather than binding something absurd", () => {
    expect(portFrom("70000")).toBe(3001);
    expect(portFrom("-1")).toBe(3001);
    expect(portFrom("http")).toBe(3001);
  });
});

describe("reportOn", () => {
  it("is ok when the loop went round recently", () => {
    expect(reportOn(1000, false, TOLERANCE).status).toBe("ok");
  });

  it("is stalled when the loop is idle and long overdue", () => {
    // Nothing running and nothing finished: the loop reschedules itself the
    // instant a poll resolves, so this cannot happen to a working runner.
    expect(reportOn(TOLERANCE + 1, false, TOLERANCE).status).toBe("stalled");
  });

  it("is ok while a poll is in flight, however long it has been", () => {
    // A thirty minute evaluation looks exactly like this, and failing the probe
    // would restart the runner in the middle of the work it exists to do.
    const report = reportOn(30 * 60_000, true, TOLERANCE);
    expect(report.status).toBe("ok");
    expect(report.polling).toBe(true);
  });

  it("reports the gap either way, so a wedged poll is still visible", () => {
    expect(reportOn(45_000, true, TOLERANCE).sinceLastPollMs).toBe(45_000);
  });

  it("does not call the exact tolerance stalled", () => {
    expect(reportOn(TOLERANCE, false, TOLERANCE).status).toBe("ok");
  });
});
