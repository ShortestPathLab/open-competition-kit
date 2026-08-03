/**
 * The config fields this package owns.
 *
 * Core knows a track takes submissions. It does not know that submissions can be
 * refused, or on what grounds, and it should not: an organiser who installs a
 * different gating package gets that package's vocabulary instead of this one's,
 * and neither has to wait for a core release to say what it reads.
 *
 * Each declaration is a Zod schema plus an editor shape. The schema decides
 * validity and normalises what it accepts; the shape describes the same fields
 * to the config editor in the vocabulary a submission form already uses, because
 * an editor needs an order, a label and a widget, and a validation schema has
 * words for none of those.
 */
import type { ConfigExtensions } from "@open-competition-kit/sdk";
import { z } from "zod";

/**
 * An instant, written as an ISO 8601 string.
 *
 * A `Date` is accepted and normalised, because js-yaml resolves an unquoted YAML
 * timestamp to one. That normalisation is not a nicety: config validation runs
 * before `propagateExtendable`, which walks anything `instanceof Object` and
 * would spread a `Date` into an empty object, losing the instant with no error
 * to explain where it went.
 *
 * An offset is not required but is strongly advised. `2026-08-01T09:00:00` is
 * read in the host's timezone, which is rarely the one the deadline was written
 * in. Prefer a trailing `Z` or an explicit `+10:00`.
 */
export const timestamp = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: `Expected an ISO 8601 date-time, got ${JSON.stringify(value)}`,
      });
      return z.NEVER;
    }
    return parsed.toISOString();
  });

export const rateLimit = z.object({
  count: z.int().positive(),
  windowMinutes: z.number().positive(),
});

export const gatedTrack = z
  .object({
    opensAt: timestamp.optional(),
    closesAt: timestamp.optional(),
    maxSubmissions: z.int().positive().optional(),
    rateLimit: rateLimit.optional(),
  })
  // A window that closes before it opens never opens at all. That is a typo
  // every time, and it is worth failing at boot rather than at the deadline,
  // when the track silently refuses the first submission anyone tries.
  .refine(
    (track) =>
      !(track.opensAt && track.closesAt) ||
      Date.parse(track.closesAt) > Date.parse(track.opensAt),
    {
      message: "closesAt must be after opensAt",
      path: ["closesAt"],
    },
  );

export type GatedTrack = z.infer<typeof gatedTrack>;

/**
 * Where computed leaderboard rows come from.
 *
 * Rows are built from job outputs: every non-failed job belonging to the
 * selected tracks contributes the output stored under `output`, which is
 * flattened into a row. Rows are then grouped, one winner is picked per group,
 * and the survivors are ranked.
 *
 * All of this is `standard`'s reading of a leaderboard rather than the only
 * possible one, which is why it is declared here. Core knows a board has columns
 * and that some loader fills in the rows.
 */
export const leaderboardSource = z.object({
  track: z.string().optional(),
  output: z.string().optional(),
  groupBy: z.enum(["user", "submission", "job", "none"]).optional(),
  select: z.enum(["best", "latest"]).optional(),
  rank: z
    .object({
      field: z.string(),
      order: z.enum(["asc", "desc"]).optional(),
    })
    .optional(),
  limit: z.number().optional(),
});

export type LeaderboardSource = z.infer<typeof leaderboardSource>;

export const runnerBody = z.object({
  /**
   * JavaScript evaluated once per job, with `submission` in scope. Whatever it
   * evaluates to is written to the job's default output, which is what a
   * leaderboard reads.
   */
  body: z.string().optional(),
});

export const config = {
  track: {
    schema: gatedTrack,
    group: { id: "gates", label: "Submission gates" },
    shape: [
      {
        id: "opensAt",
        label: "Opens at",
        kind: "datetime",
        description:
          "When the track starts accepting submissions. Leave empty and it always has. Include a timezone offset.",
      },
      {
        id: "closesAt",
        label: "Closes at",
        kind: "datetime",
        description:
          "The deadline. Submissions are refused past it wherever they arrive from, not only from the form. Leave empty and the track never closes.",
      },
      {
        id: "maxSubmissions",
        label: "Total attempts",
        kind: "number",
        description:
          "How many submissions one competitor may make to this track in all. Counts submissions rather than evaluations, so an organiser re-running a job does not spend somebody's attempt. Leave empty for no ceiling.",
      },
      {
        id: "rateLimit",
        label: "Rate limit",
        kind: "object",
        description:
          "At most `count` submissions in any `windowMinutes` period, measured backwards from now. Fixed hourly buckets would let a competitor spend one quota at 10:59 and another at 11:00.",
      },
    ],
  },
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
  runner: {
    schema: runnerBody,
    group: { id: "runner", label: "Evaluation" },
    shape: [
      {
        id: "body",
        label: "Runner body",
        kind: "code",
        description:
          "JavaScript evaluated once per job with `submission` in scope. Its result becomes the job's default output.",
      },
    ],
  },
} satisfies ConfigExtensions;
