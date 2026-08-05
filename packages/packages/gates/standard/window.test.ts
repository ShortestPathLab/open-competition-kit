import { describe, expect, test } from "bun:test";
import { load } from "js-yaml";
import { propagateExtendable } from "@open-competition-kit/sdk";
import { gatedTrack, timestamp } from "./config";
import { describeWindowState, formatInstant, isOpenAt, windowStateAt } from "./window";

const at = (iso: string) => Date.parse(iso);
const decodeTimestamp = (input: unknown) => timestamp.safeParse(input);

describe("windowStateAt", () => {
  const window = {
    opensAt: "2026-08-01T00:00:00.000Z",
    closesAt: "2026-09-01T00:00:00.000Z",
  };

  test("a track with no bounds is always open", () => {
    expect(windowStateAt({}, at("2026-08-15T00:00:00Z"))).toEqual({
      status: "open",
    });
  });

  test("reports upcoming before it opens", () => {
    expect(windowStateAt(window, at("2026-07-31T23:59:59.999Z"))).toEqual({
      status: "upcoming",
      opensAt: window.opensAt,
    });
  });

  test("opensAt is inclusive", () => {
    expect(isOpenAt(window, at("2026-08-01T00:00:00.000Z"))).toBe(true);
  });

  test("closesAt is exclusive, so the deadline itself is late", () => {
    expect(isOpenAt(window, at("2026-08-31T23:59:59.999Z"))).toBe(true);
    expect(windowStateAt(window, at("2026-09-01T00:00:00.000Z"))).toEqual({
      status: "closed",
      closesAt: window.closesAt,
    });
  });

  test("each bound stands on its own", () => {
    const longAgo = at("1999-01-01T00:00:00Z");
    const farOff = at("2099-01-01T00:00:00Z");
    expect(isOpenAt({ closesAt: window.closesAt }, longAgo)).toBe(true);
    expect(isOpenAt({ opensAt: window.opensAt }, farOff)).toBe(true);
  });
});

describe("formatInstant", () => {
  // Regression: `dateStyle` and `timeStyle` throw when combined with
  // `timeZoneName`, which took down every caller rather than just this one.
  test("renders an instant with its timezone, without throwing", () => {
    const rendered = formatInstant("2026-09-01T09:00:00.000Z");
    expect(rendered).toContain("2026");
    expect(rendered).not.toBe("2026-09-01T09:00:00.000Z");
  });

  test("describeWindowState renders rather than throwing", () => {
    const closed = windowStateAt(
      { closesAt: "2026-09-01T00:00:00.000Z" },
      at("2026-09-02T00:00:00Z"),
    );
    expect(describeWindowState(closed)).toContain("closed for submissions");
  });

  test("hands back an unparseable value unchanged", () => {
    expect(formatInstant("not a date")).toBe("not a date");
  });
});

describe("gatedTrack", () => {
  test("accepts a window that opens before it closes", () => {
    const result = gatedTrack.safeParse({
      opensAt: "2026-08-01T00:00:00Z",
      closesAt: "2026-09-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  // A window that closes before it opens never opens at all. Catching it at boot
  // beats discovering it when the first competitor is refused.
  test("rejects a window that closes before it opens", () => {
    const result = gatedTrack.safeParse({
      opensAt: "2026-09-01T00:00:00Z",
      closesAt: "2026-08-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("closesAt must be after opensAt");
  });

  test("rejects a window that closes exactly when it opens", () => {
    const instant = "2026-08-01T00:00:00Z";
    const result = gatedTrack.safeParse({
      opensAt: instant,
      closesAt: instant,
    });
    expect(result.success).toBe(false);
  });

  // Core no longer declares these, so a track only gets them because this
  // package said it may have them. Everything else on the node is somebody
  // else's and is left where it was found.
  test("claims only its own fields", () => {
    const result = gatedTrack.safeParse({
      id: "t1",
      with: [],
      maxSubmissions: 3,
    });
    expect(result.success).toBe(true);
    expect(Object.keys(result.data ?? {})).toEqual(["maxSubmissions"]);
  });

  test("rejects an attempt ceiling of zero", () => {
    expect(gatedTrack.safeParse({ maxSubmissions: 0 }).success).toBe(false);
  });
});

describe("timestamp", () => {
  test("accepts an ISO string and normalises it", () => {
    expect(decodeTimestamp("2026-08-01T09:00:00+10:00")).toMatchObject({
      data: "2026-07-31T23:00:00.000Z",
    });
  });

  // js-yaml resolves an unquoted YAML timestamp to a Date, so organisers who
  // leave the quotes off must not get a parse error for their trouble.
  test("accepts the Date js-yaml produces for an unquoted timestamp", () => {
    const document = load("closesAt: 2026-09-01T09:00:00Z") as Record<string, unknown>;
    const parsed = document.closesAt;
    expect(parsed).toBeInstanceOf(Date);
    expect(decodeTimestamp(parsed)).toMatchObject({
      data: "2026-09-01T09:00:00.000Z",
    });
  });

  test("rejects something that is not a date", () => {
    expect(decodeTimestamp("next tuesday").success).toBe(false);
  });

  // The instant has to survive the config walk. `propagateExtendable` spreads
  // every `instanceof Object` it meets, which would quietly empty out a Date and
  // leave the track with no deadline at all. Validation runs before that walk,
  // which is what makes the normalisation above load-bearing rather than tidy.
  test("survives propagateExtendable as a string", () => {
    const decoded = decodeTimestamp(new Date("2026-09-01T09:00:00Z"));
    expect(decoded).toMatchObject({ data: "2026-09-01T09:00:00.000Z" });

    const walked = propagateExtendable({
      with: [],
      closesAt: decoded.data as string,
    });
    expect(walked.closesAt).toBe("2026-09-01T09:00:00.000Z");
  });
});
