import { lazyComponent, type Package } from "@open-competition-kit/sdk";
import { rows } from "@open-competition-kit/leaderboard-common";
import view from "./chart";

/** The kinds this package draws. Anything else is passed inward. */
const KINDS = new Set(["chart"]);

const source = lazyComponent(view);

/**
 * A whole leaderboard, not half of one.
 *
 * The rows and the drawing arrive together, from `rows` and from here, so an
 * organiser installs this and has a working board rather than installing this and
 * then discovering they also need something to compute what goes in it. The row
 * computation is shared with every other first-party leaderboard package, so
 * installing two of them declares `from:` twice with the same meaning, which is
 * what `validateNode` allows.
 */
export default {
  name: "@open-competition-kit/leaderboard-chart",
  description:
    "Renders leaderboards as bar, line or area charts with Recharts, and computes their rows from job outputs.",
  version: "0.0.11",
  config: rows.config,
  leaderboard: {
    loader: rows.loader,
    ui: async ({ kind }, next) => (KINDS.has(kind) ? source() : next?.({ kind })),
  },
} satisfies Package;
