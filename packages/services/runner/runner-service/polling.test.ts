import { afterEach, describe, expect, jest, test } from "bun:test";
import { createPollingWorker } from "./polling";

// Let the promise/microtask chain inside `tick` settle before asserting.
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

// A poll whose resolution the test controls, so "in flight" is a real state.
const deferredPoll = () => {
  let release!: () => void;
  const poll = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  return { poll, release: () => release() };
};

afterEach(() => {
  jest.useRealTimers();
});

describe("createPollingWorker", () => {
  test("polls once immediately on start", async () => {
    jest.useFakeTimers();
    const poll = jest.fn(async () => {});
    const worker = createPollingWorker({ intervalMs: 1000, poll });

    worker.start();
    await flush();

    expect(poll).toHaveBeenCalledTimes(1);
    worker.stop();
  });

  test("never runs two polls at once", async () => {
    jest.useFakeTimers();
    const { poll } = deferredPoll();
    const worker = createPollingWorker({ intervalMs: 1000, poll });

    worker.start();
    await flush();
    // A tick that lands while the first poll is still pending must be ignored,
    // or a slow poll would pile up behind faster ticks.
    await worker.tick();

    expect(poll).toHaveBeenCalledTimes(1);
    worker.stop();
  });

  test("routes a failing poll to onError and keeps polling", async () => {
    jest.useFakeTimers();
    const boom = new Error("poll blew up");
    const poll = jest.fn(async () => {
      throw boom;
    });
    const onError = jest.fn();
    const worker = createPollingWorker({ intervalMs: 1000, poll, onError });

    worker.start();
    await flush();

    expect(onError).toHaveBeenCalledWith(boom);
    expect(poll).toHaveBeenCalledTimes(1);

    // One thrown poll must not kill the loop — the next interval still fires.
    jest.advanceTimersByTime(1000);
    await flush();
    expect(poll).toHaveBeenCalledTimes(2);
    worker.stop();
  });

  test("schedules the next poll exactly one interval after the last finishes", async () => {
    jest.useFakeTimers();
    const { poll, release } = deferredPoll();
    const worker = createPollingWorker({ intervalMs: 1000, poll });

    worker.start();
    await flush();
    expect(poll).toHaveBeenCalledTimes(1);

    // The interval is measured from completion, not from start: while the first
    // poll is still running, no amount of elapsed time schedules another.
    jest.advanceTimersByTime(5000);
    await flush();
    expect(poll).toHaveBeenCalledTimes(1);

    release();
    await flush();
    jest.advanceTimersByTime(999);
    await flush();
    expect(poll).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    await flush();
    expect(poll).toHaveBeenCalledTimes(2);
    worker.stop();
  });

  test("stop cancels the pending interval", async () => {
    jest.useFakeTimers();
    const poll = jest.fn(async () => {});
    const worker = createPollingWorker({ intervalMs: 1000, poll });

    worker.start();
    await flush();
    worker.stop();

    jest.advanceTimersByTime(10_000);
    await flush();
    expect(poll).toHaveBeenCalledTimes(1);
  });

  test("stop during an in-flight poll prevents it from rescheduling", async () => {
    jest.useFakeTimers();
    const { poll, release } = deferredPoll();
    const worker = createPollingWorker({ intervalMs: 1000, poll });

    worker.start();
    await flush();
    worker.stop();

    // The poll resolves after stop; its `finally` must see the stop and not arm
    // a new timer.
    release();
    await flush();
    jest.advanceTimersByTime(10_000);
    await flush();

    expect(poll).toHaveBeenCalledTimes(1);
  });
});
