import { describe, expect, it } from "bun:test";
import { isTerminal, JobStatus, staleClaims } from "./job";

const job = (id: string, status: string, claimedAt: string) => ({ id, status, claimedAt });

const CUTOFF = "2026-08-06T12:00:00.000Z";

describe("staleClaims", () => {
  it("reclaims a job whose claim predates the cutoff", () => {
    const held = [job("a", JobStatus.running, "2026-08-06T11:00:00.000Z")];
    expect(staleClaims(held, CUTOFF).map((j) => j.id)).toEqual(["a"]);
  });

  it("leaves a claim newer than the cutoff alone", () => {
    // The runner holding this one is presumed alive, and taking its job would
    // mean two processes evaluating the same submission.
    const held = [job("a", JobStatus.running, "2026-08-06T12:30:00.000Z")];
    expect(staleClaims(held, CUTOFF)).toEqual([]);
  });

  it("treats a claim exactly at the cutoff as still held", () => {
    const held = [job("a", JobStatus.running, CUTOFF)];
    expect(staleClaims(held, CUTOFF)).toEqual([]);
  });

  it("ignores a running job carrying no claim stamp", () => {
    // Something wrote `running` without claiming. Sweeping it would be guessing
    // about a row the sweep does not understand.
    const held = [job("a", JobStatus.running, "")];
    expect(staleClaims(held, CUTOFF)).toEqual([]);
  });

  it("ignores rows that are not running, however old", () => {
    const held = [
      job("a", JobStatus.done, "2020-01-01T00:00:00.000Z"),
      job("b", JobStatus.pending, "2020-01-01T00:00:00.000Z"),
      job("c", JobStatus.error, "2020-01-01T00:00:00.000Z"),
    ];
    expect(staleClaims(held, CUTOFF)).toEqual([]);
  });

  it("picks out only the stale ones from a mixed queue", () => {
    const held = [
      job("old", JobStatus.running, "2026-08-06T09:00:00.000Z"),
      job("fresh", JobStatus.running, "2026-08-06T13:00:00.000Z"),
      job("unstamped", JobStatus.running, ""),
      job("finished", JobStatus.done, "2026-08-06T09:00:00.000Z"),
    ];
    expect(staleClaims(held, CUTOFF).map((j) => j.id)).toEqual(["old"]);
  });
});

describe("isTerminal", () => {
  it("knows which statuses nothing will move a job out of", () => {
    expect(isTerminal(JobStatus.done)).toBe(true);
    expect(isTerminal(JobStatus.error)).toBe(true);
    expect(isTerminal(JobStatus.skipped)).toBe(true);
    expect(isTerminal(JobStatus.pending)).toBe(false);
    expect(isTerminal(JobStatus.running)).toBe(false);
  });

  it("does not claim to recognise a status a package invented", () => {
    expect(isTerminal("queued-for-review")).toBe(false);
  });
});
