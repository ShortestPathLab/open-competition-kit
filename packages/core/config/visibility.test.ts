import { describe, expect, test } from "bun:test";
import { Effect as E, Schema as S } from "effect";
import { CompetitionConfig } from "./schema";
import { isDraft, isVisibleTo } from "./visibility";

describe("visibility", () => {
  // Every competition configured before this field existed has no `visibility`.
  // Reading absence as a draft would empty the index on upgrade.
  test("absent visibility is published", () => {
    expect(isDraft({})).toBe(false);
    expect(isVisibleTo({}, false)).toBe(true);
  });

  test("a draft is hidden from everyone but an organiser", () => {
    const draft = { visibility: "draft" };
    expect(isVisibleTo(draft, false)).toBe(false);
    expect(isVisibleTo(draft, true)).toBe(true);
  });

  test("published is visible to everyone", () => {
    const published = { visibility: "published" };
    expect(isVisibleTo(published, false)).toBe(true);
    expect(isDraft(published)).toBe(false);
  });
});

describe("CompetitionConfig visibility", () => {
  const competition = (visibility?: string) => ({
    id: "c1",
    with: [],
    tracks: [],
    runner: { with: [] },
    leaderboards: [],
    ...(visibility === undefined ? {} : { visibility }),
  });
  const decode = (input: unknown) =>
    E.runPromise(E.either(S.decodeUnknown(CompetitionConfig)(input)));

  test("accepts draft and published, and neither", async () => {
    expect((await decode(competition("draft")))._tag).toBe("Right");
    expect((await decode(competition("published")))._tag).toBe("Right");
    expect((await decode(competition()))._tag).toBe("Right");
  });

  // A typo here fails open — the competition stays public — so it is worth
  // refusing at boot rather than accepting a value that means nothing.
  test("rejects anything else", async () => {
    expect((await decode(competition("hidden")))._tag).toBe("Left");
    expect((await decode(competition("Draft")))._tag).toBe("Left");
  });
});
