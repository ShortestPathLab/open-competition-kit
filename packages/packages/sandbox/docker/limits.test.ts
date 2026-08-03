import { describe, expect, test } from "bun:test";
import { sandbox } from "./config";
import { atMost, clamp, permitted } from "./limits";

describe("atMost", () => {
  test("keeps the ask when there is no ceiling", () => {
    expect(atMost(4096, undefined)).toBe(4096);
  });

  test("takes the ceiling when nothing was asked for", () => {
    expect(atMost(undefined, 2048)).toBe(2048);
  });

  test("takes the smaller of the two", () => {
    expect(atMost(4096, 2048)).toBe(2048);
    expect(atMost(1024, 2048)).toBe(1024);
  });

  test("stays undefined when neither side says anything", () => {
    expect(atMost(undefined, undefined)).toBeUndefined();
  });
});

describe("permitted", () => {
  test("a withheld permission denies the ask", () => {
    expect(permitted(true, false)).toBe(false);
  });

  test("a granted permission is still not the same as asking", () => {
    expect(permitted(undefined, true)).toBeUndefined();
    expect(permitted(false, true)).toBe(false);
  });

  test("no ceiling leaves the ask alone", () => {
    expect(permitted(true, undefined)).toBe(true);
  });
});

describe("clamp", () => {
  const ceiling = { timeoutMs: 120_000, memoryMb: 2048, cpus: 1, pids: 256 };

  test("a greedy run comes back at the ceiling", () => {
    expect(
      clamp(
        { timeoutMs: 600_000, limits: { memoryMb: 16_384, pids: 4096 } },
        ceiling,
      ),
    ).toEqual({
      timeoutMs: 120_000,
      limits: {
        memoryMb: 2048,
        cpus: 1,
        pids: 256,
        network: undefined,
        writable: undefined,
      },
    });
  });

  test("a modest run is left as it was", () => {
    expect(
      clamp({ timeoutMs: 35_000, limits: { memoryMb: 512, cpus: 0.5 } }, ceiling)
        .timeoutMs,
    ).toBe(35_000);
    expect(
      clamp({ timeoutMs: 35_000, limits: { memoryMb: 512, cpus: 0.5 } }, ceiling)
        .limits,
    ).toMatchObject({ memoryMb: 512, cpus: 0.5 });
  });

  // The case a maximum-only reading would miss. Nothing in core defaults
  // `cpus`, so a run that never mentions it would otherwise get the whole
  // machine on a host that plainly asked for one core.
  test("a ceiling binds a field the run never mentioned", () => {
    expect(clamp({}, ceiling).limits?.cpus).toBe(1);
  });

  test("an empty ceiling changes nothing", () => {
    expect(clamp({ timeoutMs: 35_000, limits: { cpus: 8 } }, {})).toMatchObject({
      timeoutMs: 35_000,
      limits: { cpus: 8 },
    });
  });

  test("a withheld network cannot be asked back on", () => {
    expect(
      clamp({ limits: { network: true } }, { network: false }).limits?.network,
    ).toBe(false);
  });

  test("a withheld writable root cannot be asked back on", () => {
    expect(
      clamp({ limits: { writable: true } }, { writable: false }).limits
        ?.writable,
    ).toBe(false);
  });
});

describe("the sandbox: block", () => {
  test("an absent block is a ceiling of nothing", () => {
    const read = sandbox.safeParse({});
    expect(read.success).toBe(true);
    expect(clamp({ timeoutMs: 600_000 }, read.data ?? {}).timeoutMs).toBe(
      600_000,
    );
  });

  test("a limit of zero is refused rather than read as unlimited", () => {
    expect(sandbox.safeParse({ memoryMb: 0 }).success).toBe(false);
  });

  test("a fractional process count is refused", () => {
    expect(sandbox.safeParse({ pids: 1.5 }).success).toBe(false);
    expect(sandbox.safeParse({ cpus: 0.5 }).success).toBe(true);
  });
});
