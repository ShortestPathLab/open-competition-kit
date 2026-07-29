import { describe, expect, test } from "bun:test";
import { Effect as E, Schema as S } from "effect";
import { load } from "js-yaml";
import { Timestamp, TrackConfig } from "./schema";
import { propagateExtendable } from "./index";
import {
  describeWindowState,
  formatInstant,
  isOpenAt,
  windowStateAt,
} from "./window";

const at = (iso: string) => Date.parse(iso);
const decodeTimestamp = (input: unknown) =>
  E.runPromise(E.either(S.decodeUnknown(Timestamp)(input)));

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

describe("TrackConfig", () => {
  const track = (window: Record<string, string>) => ({
    id: "t1",
    with: [],
    form: { with: [], shape: [] },
    ...window,
  });
  const decodeTrack = (input: unknown) =>
    E.runPromise(E.either(S.decodeUnknown(TrackConfig)(input)));

  test("accepts a window that opens before it closes", async () => {
    const result = await decodeTrack(
      track({
        opensAt: "2026-08-01T00:00:00Z",
        closesAt: "2026-09-01T00:00:00Z",
      }),
    );
    expect(result._tag).toBe("Right");
  });

  // A window that closes before it opens never opens at all. Catching it at boot
  // beats discovering it when the first competitor is refused.
  test("rejects a window that closes before it opens", async () => {
    const result = await decodeTrack(
      track({
        opensAt: "2026-09-01T00:00:00Z",
        closesAt: "2026-08-01T00:00:00Z",
      }),
    );
    expect(result._tag).toBe("Left");
    expect(String((result as { left: unknown }).left)).toContain(
      "which is not after it opens at",
    );
  });

  test("rejects a window that closes exactly when it opens", async () => {
    const instant = "2026-08-01T00:00:00Z";
    const result = await decodeTrack(
      track({ opensAt: instant, closesAt: instant }),
    );
    expect(result._tag).toBe("Left");
  });
});

describe("Timestamp", () => {
  test("accepts an ISO string and normalises it", async () => {
    const result = await decodeTimestamp("2026-08-01T09:00:00+10:00");
    expect(result).toMatchObject({ right: "2026-07-31T23:00:00.000Z" });
  });

  // js-yaml resolves an unquoted YAML timestamp to a Date, so organisers who
  // leave the quotes off must not get a parse error for their trouble.
  test("accepts the Date js-yaml produces for an unquoted timestamp", async () => {
    const document = load("closesAt: 2026-09-01T09:00:00Z") as Record<
      string,
      unknown
    >;
    const parsed = document.closesAt;
    expect(parsed).toBeInstanceOf(Date);
    expect(await decodeTimestamp(parsed)).toMatchObject({
      right: "2026-09-01T09:00:00.000Z",
    });
  });

  test("rejects something that is not a date", async () => {
    const result = await decodeTimestamp("next tuesday");
    expect(result._tag).toBe("Left");
  });

  // The instant has to survive the config walk. `propagateExtendable` spreads
  // every `instanceof Object` it meets, which would quietly empty out a Date and
  // leave the track with no deadline at all.
  test("survives propagateExtendable as a string", async () => {
    const decoded = await decodeTimestamp(new Date("2026-09-01T09:00:00Z"));
    expect(decoded).toMatchObject({ right: "2026-09-01T09:00:00.000Z" });

    const walked = propagateExtendable({
      with: [],
      closesAt: (decoded as { right: string }).right,
    });
    expect(walked.closesAt).toBe("2026-09-01T09:00:00.000Z");
  });
});
