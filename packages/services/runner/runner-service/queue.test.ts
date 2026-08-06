import { describe, expect, it } from "bun:test";
import { concurrencyFrom, mapWithLimit, settleStatus } from "./queue";

const RUNNING = "running";
const SKIPPED = "skipped";

/** A task whose completion the test controls, so "in flight" is observable. */
const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release: () => release() };
};

describe("concurrencyFrom", () => {
  it("defaults when the variable is unset or blank", () => {
    expect(concurrencyFrom(undefined)).toBe(4);
    expect(concurrencyFrom("   ")).toBe(4);
  });

  it("takes a whole number of at least one", () => {
    expect(concurrencyFrom("1")).toBe(1);
    expect(concurrencyFrom("16")).toBe(16);
  });

  it("falls back rather than trusting nonsense", () => {
    // Zero would stop the service processing anything at all, and a fraction
    // would round somewhere nobody asked for. Both are worth ignoring loudly.
    expect(concurrencyFrom("0")).toBe(4);
    expect(concurrencyFrom("-2")).toBe(4);
    expect(concurrencyFrom("2.5")).toBe(4);
    expect(concurrencyFrom("lots")).toBe(4);
  });
});

describe("settleStatus", () => {
  it("leaves a job the runner already finished alone", () => {
    // The ordinary path. Overwriting here would replace a real result with a
    // guess made by the service that only drove the chain.
    expect(settleStatus("done", { status: "done" }, RUNNING, SKIPPED)).toBeUndefined();
    expect(settleStatus("error", { status: "error" }, RUNNING, SKIPPED)).toBeUndefined();
  });

  it("skips a job still running once every runner has passed on it", () => {
    expect(settleStatus(RUNNING, { status: SKIPPED }, RUNNING, SKIPPED)).toBe(SKIPPED);
  });

  it("skips a job when the chain answered with nothing at all", () => {
    expect(settleStatus(RUNNING, undefined, RUNNING, SKIPPED)).toBe(SKIPPED);
    expect(settleStatus(RUNNING, {}, RUNNING, SKIPPED)).toBe(SKIPPED);
  });

  it("does not leave a job claiming to still be running", () => {
    // A runner reporting `running` as its outcome has said nothing terminal, and
    // taking it at its word would strand the row under this service's claim.
    expect(settleStatus(RUNNING, { status: RUNNING }, RUNNING, SKIPPED)).toBe(SKIPPED);
  });

  it("writes back a terminal status a runner reported without recording it", () => {
    expect(settleStatus(RUNNING, { status: "done" }, RUNNING, SKIPPED)).toBe("done");
  });
});

describe("mapWithLimit", () => {
  it("runs every item exactly once", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const seen: number[] = [];
    await mapWithLimit(items, 3, async (n) => {
      seen.push(n);
    });
    expect(seen.toSorted((a, b) => a - b)).toEqual(items);
  });

  it("never has more than the limit in flight", async () => {
    const gates = Array.from({ length: 6 }, deferred);
    let live = 0;
    let peak = 0;

    const all = mapWithLimit(gates, 2, async (gate) => {
      live++;
      peak = Math.max(peak, live);
      await gate.promise;
      live--;
    });

    // Two started, four waiting. Releasing one frees exactly one slot, so the
    // peak cannot climb past the limit however many items are queued.
    await Promise.resolve();
    expect(peak).toBe(2);
    for (const gate of gates) {
      gate.release();
      await Promise.resolve();
    }
    await all;
    expect(peak).toBe(2);
  });

  it("starts the next item as soon as a slot frees, not when the batch ends", async () => {
    const gates = Array.from({ length: 3 }, deferred);
    const started: number[] = [];

    const all = mapWithLimit([0, 1, 2], 1, async (index) => {
      started.push(index);
      await gates[index]!.promise;
    });

    await Promise.resolve();
    expect(started).toEqual([0]);

    gates[0]!.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual([0, 1]);

    gates[1]!.release();
    gates[2]!.release();
    await all;
    expect(started).toEqual([0, 1, 2]);
  });

  it("does nothing, and does not hang, on an empty list", async () => {
    let ran = false;
    await mapWithLimit([], 4, async () => {
      ran = true;
    });
    expect(ran).toBe(false);
  });

  it("does not start more workers than there are items", async () => {
    const gates = Array.from({ length: 2 }, deferred);
    let live = 0;
    let peak = 0;

    const all = mapWithLimit(gates, 10, async (gate) => {
      live++;
      peak = Math.max(peak, live);
      await gate.promise;
      live--;
    });

    await Promise.resolve();
    expect(peak).toBe(2);
    for (const gate of gates) gate.release();
    await all;
  });
});
