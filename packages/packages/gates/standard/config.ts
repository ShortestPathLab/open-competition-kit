/**
 * The three rules an organiser writes on a track, and nothing else.
 *
 * Declared here rather than in `standard` because a gate is policy. Plenty of
 * competitions have no deadline, no attempt ceiling and no rate limit, and an
 * organiser gating through their institution's systems wants this vocabulary
 * gone rather than merely unset. A package that declares a field it does not
 * enforce is the thing that makes `without:` necessary, so a default package
 * declares nothing and this one is not a default.
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
export const timestamp = z.union([z.string(), z.date()]).transform((value, ctx) => {
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
      !(track.opensAt && track.closesAt) || Date.parse(track.closesAt) > Date.parse(track.opensAt),
    { message: "closesAt must be after opensAt", path: ["closesAt"] },
  );

export type GatedTrack = z.infer<typeof gatedTrack>;

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
} satisfies ConfigExtensions;
