/**
 * The half of a leaderboard package that has nothing to do with how it looks.
 *
 * A library rather than a package. It is never named in a `with:` list, and an
 * organiser never learns it exists. Every first-party leaderboard package pulls
 * it in and re-exports both halves, so installing one thing gives a working
 * board: rows computed from job outputs, and something to draw them with.
 *
 * That is a deliberate reversal of an earlier arrangement where the loader lived
 * in `standard` and the renderers were separate. Splitting them made an organiser
 * install two packages and think about a backend for what is, to them, one
 * feature. The many-to-one relationship it was protecting (several looks over one
 * data source) is real, but it is served by `kind:` choosing a renderer rather
 * than by the loader living somewhere else.
 *
 * Several packages therefore declare `from:` at once, which `validateNode` allows
 * because they all got the declaration from here and so agree on what it means.
 */
import type { Leaderboard, Package } from "@open-competition-kit/sdk";
import { config } from "./config";
import { load } from "./leaderboard";

export * from "./config";
export * from "./leaderboard";

/**
 * Rows for a board, unless a package further in has already produced them.
 *
 * Yields to `next` first, so a competition that installs a loader of its own
 * keeps it, and answers with the board's literal `items` when no `from:` is set,
 * which is how a board configured for some other loader passes through here
 * unharmed.
 */
export const loader: NonNullable<NonNullable<Package["leaderboard"]>["loader"]> = async (
  { def, competition },
  next,
) => {
  const inherited = await next?.({ def, competition });
  if (inherited) return inherited;
  return { def: { ...def, items: await load(def as Leaderboard, competition) } };
};

/** What every first-party leaderboard package contributes besides its renderer. */
export const rows = { config, loader };
