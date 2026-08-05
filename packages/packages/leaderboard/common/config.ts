/**
 * Where computed leaderboard rows come from.
 *
 * Rows are built from job outputs: every non-failed job belonging to the selected
 * tracks contributes the output stored under `output`, which is flattened into a
 * row. Rows are then grouped, one winner is picked per group, and the survivors
 * are ranked.
 *
 * Declared here, in a library rather than a package, so that every leaderboard
 * package can ship the loader it needs and an organiser installs one thing to get
 * a working board. Several packages declaring the same field is a declaration
 * contributed twice rather than a dispute, which is what `validateNode` allows as
 * long as they agree on what the value becomes. They agree here because they are
 * all re-exporting this.
 */
import { z } from "zod";

export const leaderboardSource = z.object({
  track: z.string().optional(),
  output: z.string().optional(),
  groupBy: z.enum(["user", "submission", "job", "none"]).optional(),
  select: z.enum(["best", "latest"]).optional(),
  rank: z.object({ field: z.string(), order: z.enum(["asc", "desc"]).optional() }).optional(),
  limit: z.number().optional(),
});

export type LeaderboardSource = z.infer<typeof leaderboardSource>;

export const config = {
  leaderboard: {
    schema: z.object({ from: leaderboardSource.optional() }),
    group: { id: "rows", label: "Row source" },
    shape: [
      {
        id: "from",
        label: "Row source",
        kind: "object",
        description:
          "Which jobs' outputs become rows, how they are grouped, and how they are ranked. Takes precedence over any literal `items`.",
      },
    ],
  },
};
