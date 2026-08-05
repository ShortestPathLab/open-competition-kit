import { describe, expect, mock, test } from "bun:test";
import type { Source } from "@open-competition-kit/core/hook/component";
import { std, surfaces, views, type SurfaceItem, type SurfaceRequest } from "./surface";

const request = (surface: string, items: readonly SurfaceItem[] = []): SurfaceRequest => ({
  surface,
  audience: "participant",
  user: "someone@example.com",
  subject: { competition: "cup", track: "open" },
  items,
});

const note = (id: string): SurfaceItem => ({ kind: "note", id, title: id });

describe("surfaces", () => {
  test("contributes only to the region it was asked about", async () => {
    const content = surfaces({
      [std.competitionYou]: async () => [note("mine")],
    });

    expect(await content(request(std.competitionYou))).toEqual([note("mine")]);
    expect(await content(request(std.meOverview))).toEqual([]);
  });

  test("appends to what the packages further out contributed", async () => {
    const content = surfaces({
      [std.competitionYou]: async () => [note("mine")],
    });

    expect(await content(request(std.competitionYou, [note("theirs")]))).toEqual([
      note("theirs"),
      note("mine"),
    ]);
  });

  // The mistake this helper exists to prevent: an implementation that returns its
  // own list instead of what `next` handed back drops every contribution beneath
  // it, and looks correct while doing it.
  test("passes the combined list inward and returns what came back", async () => {
    const inner = mock(async (r: SurfaceRequest) => [...r.items, note("inner")]);
    const content = surfaces({
      [std.competitionYou]: async () => [note("outer")],
    });

    const items = await content(request(std.competitionYou), inner);

    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner.mock.calls[0]?.[0].items).toEqual([note("outer")]);
    expect(items).toEqual([note("outer"), note("inner")]);
  });

  // `noop` sits innermost and answers with nothing, which is what terminates the
  // chain.
  test("falls back to its own list when the chain answers with nothing", async () => {
    const content = surfaces({
      [std.competitionYou]: async () => [note("mine")],
    });
    const empty = async () => undefined as never;

    expect(await content(request(std.competitionYou), empty)).toEqual([note("mine")]);
  });

  test("a contributor that throws loses its own content and nothing else", async () => {
    const content = surfaces({
      [std.competitionYou]: async () => {
        throw new Error("GitHub is down");
      },
    });

    expect(await content(request(std.competitionYou, [note("theirs")]))).toEqual([note("theirs")]);
  });

  test("accepts a region this build of core has never heard of", async () => {
    const content = surfaces({ "acme/surface/whatever": async () => [note("x")] });

    expect(await content(request("acme/surface/whatever"))).toEqual([note("x")]);
  });
});

describe("views", () => {
  const source = (id: string) =>
    ({
      type: "open-competition-kit/hook/component-source",
      source: id,
    }) as Source<any>;

  test("answers for its own ids", async () => {
    const view = views({ "acme/card": async () => source("acme") });

    expect(await view({ view: "acme/card" })).toEqual(source("acme"));
  });

  test("passes an id it does not own inward", async () => {
    const view = views({ "acme/card": async () => source("acme") });
    const inner = mock(async () => source("other"));

    expect(await view({ view: "other/card" }, inner)).toEqual(source("other"));
    expect(inner).toHaveBeenCalledTimes(1);
  });

  // Not an error. The caller draws the item's fallback, which is why an item
  // carries one.
  test("answers with nothing when no package owns the id", async () => {
    const view = views({});

    expect(await view({ view: "nobody/card" })).toBeUndefined();
  });

  test("does not build a view nobody asked for", async () => {
    const build = mock(async () => source("acme"));
    const view = views({ "acme/card": build, "acme/other": build });

    await view({ view: "acme/card" });

    expect(build).toHaveBeenCalledTimes(1);
  });
});
