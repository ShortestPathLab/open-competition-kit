import { ParseResult, Schema as S } from "effect";
import { Meta, Shape } from "../hook";
import { Item, Value } from "../common/shape";

/**
 * An instant, written in config as an ISO 8601 string.
 *
 * A `Date` is accepted as well and normalised to a string, because js-yaml
 * resolves an unquoted YAML timestamp to a `Date` — and `propagateExtendable`
 * walks anything that is `instanceof Object`, so a `Date` reaching it would be
 * spread into an empty object and the instant lost entirely. Normalising at
 * decode keeps that from ever being reachable.
 *
 * An offset is not required but is strongly advised: `2026-08-01T09:00:00` is
 * read in the host's timezone, which is rarely the one the deadline was written
 * in. Prefer a trailing `Z` or an explicit `+10:00`.
 */
export const Timestamp = S.transformOrFail(
  S.Union(S.String, S.DateFromSelf),
  S.String,
  {
    strict: true,
    decode: (input, _options, ast) => {
      const parsed = input instanceof Date ? input : new Date(input);
      return (
        Number.isNaN(parsed.getTime()) ?
          ParseResult.fail(
            new ParseResult.Type(
              ast,
              input,
              `Expected an ISO 8601 date-time, got ${JSON.stringify(input)}`,
            ),
          )
        : ParseResult.succeed(parsed.toISOString())
      );
    },
    encode: (value) => ParseResult.succeed(value),
  },
);

export const Extendable = S.Struct({ with: S.Array(S.String) });

export const FormConfig = S.Struct({
  ...Meta.fields,
  shape: S.Array(S.Struct({ ...Shape.fields, ...Meta.fields })),
});

/**
 * Describes where a leaderboard's rows come from.
 *
 * Rows are built from job outputs: every non-failed job belonging to the
 * selected tracks contributes the output stored under `output`, which is
 * flattened into a row. Rows are then grouped, one winner is picked per group,
 * and the survivors are ranked.
 */
export const LeaderboardSource = S.Struct({
  /** Restrict to a single track. Defaults to every track in the competition. */
  track: S.optional(S.String),
  /** Which job output reference to read. Defaults to `default`. */
  output: S.optional(S.String),
  /** One row per `user` (default), `submission`, `job`, or `none` to skip grouping. */
  groupBy: S.optional(
    S.Literal("user", "submission", "job", "none"),
  ),
  /** Which row wins its group: the `best` by `rank` (default), or the `latest`. */
  select: S.optional(S.Literal("best", "latest")),
  /** How to order rows, and what `best` means. */
  rank: S.optional(
    S.Struct({
      field: S.String,
      order: S.optional(S.Literal("asc", "desc")),
    }),
  ),
  /** Keep only the first N rows after ranking. */
  limit: S.optional(S.Number),
});

export const LeaderboardConfig = S.Struct({
  ...Meta.fields,
  shape: S.Array(Shape),
  /** Literal rows. Used when `from` is absent — handy for demos and static boards. */
  items: S.optional(S.Array(S.Record({ key: S.String, value: Value }))),
  /** Computed rows. Takes precedence over `items`. */
  from: S.optional(LeaderboardSource),
  /** Renderer-specific settings, passed through to whichever package draws this board. */
  options: S.optional(S.Record({ key: S.String, value: S.Any })),
});

export const TrackConfig = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  description: S.optional(S.String),
  overview: S.optional(S.String),
  rules: S.optional(S.String),
  /**
   * When the track starts accepting submissions. Absent means it always has.
   */
  opensAt: S.optional(Timestamp),
  /**
   * When the track stops accepting them. Absent means it never does.
   *
   * This is the deadline, and it is enforced rather than advertised: submissions
   * are refused past it wherever they arrive from, not only from the form.
   */
  closesAt: S.optional(Timestamp),
  /**
   * How many submissions one competitor may make to this track in total. Absent
   * means no ceiling.
   *
   * Counts submissions rather than jobs. A submission that is re-run does not
   * spend another attempt, which is the reading a competitor expects and the one
   * that does not punish them for an organiser's retry.
   */
  maxSubmissions: S.optional(S.Number.pipe(S.int(), S.positive())),
  /**
   * A rolling cap: at most `count` submissions in any `windowMinutes` period,
   * measured backwards from now rather than against fixed clock boundaries.
   *
   * Fixed buckets let a competitor spend a whole quota at 10:59 and another at
   * 11:00; a rolling window is what people mean when they say "three an hour".
   */
  rateLimit: S.optional(
    S.Struct({
      count: S.Number.pipe(S.int(), S.positive()),
      windowMinutes: S.Number.pipe(S.positive()),
    }),
  ),
  form: S.Struct({ ...Extendable.fields, ...FormConfig.fields }),
}).pipe(
  // A window that closes before it opens never opens at all. That is a typo
  // every time, and it is worth failing at boot rather than at the deadline,
  // when the track silently refuses the first submission anyone tries.
  S.filter((track) =>
    (
      track.opensAt &&
      track.closesAt &&
      Date.parse(track.closesAt) <= Date.parse(track.opensAt)
    ) ?
      `Track "${track.id}" closes at ${track.closesAt}, which is not after it opens at ${track.opensAt}.`
    : undefined,
  ),
);

export const CompetitionConfig = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  /**
   * Whether the competition is public yet.
   *
   * A `draft` is visible to the organisers in `admins` and to nobody else: it is
   * absent from the index, its pages read as missing, and it takes no enrolments
   * or submissions. That is what makes it useful — a competition can be written,
   * previewed and corrected in place before anyone can find it.
   *
   * Defaults to `published`, because the alternative would hide every competition
   * that was configured before this field existed.
   */
  visibility: S.optional(S.Literal("draft", "published")),
  organiser: S.optional(S.String),
  description: S.optional(S.String),
  overview: S.optional(S.String),
  rules: S.optional(S.String),
  tracks: S.Array(TrackConfig),
  runner: S.Struct({ ...Extendable.fields, body: S.optional(S.String) }),
  leaderboards: S.Array(
    S.Struct({
      ...Item.fields,
      ...Extendable.fields,
      ...LeaderboardConfig.fields,
    }),
  ),
});

export const Config = S.Struct({
  appName: S.String,
  appDescription: S.String,
  auth: S.Record({ key: S.String, value: S.Any }),
  competitions: S.Array(CompetitionConfig),
  db: S.Struct({}),
  secrets: S.optional(S.Record({ key: S.String, value: S.String })),
  /**
   * Email addresses permitted to reach the organiser dashboard. Absent or empty
   * means nobody can — the dashboard fails closed, since an unguarded admin
   * surface is worse than an unreachable one.
   */
  admins: S.optional(S.Array(S.String)),
  /**
   * Settings for whichever package implements the `files` hooks. Backend-specific,
   * so it is passed through unvalidated — `root` for the local backend, bucket and
   * credentials for S3.
   */
  largeFiles: S.optional(S.Record({ key: S.String, value: S.Any })),
  /**
   * Confinement defaults for whichever package implements the `sandbox` hooks.
   *
   * An organiser's ceiling, not a runner's preference: a runner may ask for less
   * than this but never for more, so one careless package cannot hand a stranger
   * the whole machine. `timeoutMs`, `memoryMb`, `pids`.
   */
  sandbox: S.optional(S.Record({ key: S.String, value: S.Any })),
  ...Extendable.fields,
});

export type Config = S.Schema.Type<typeof Config>;
export type Form = S.Schema.Type<typeof FormConfig>;
export type Leaderboard = S.Schema.Type<typeof LeaderboardConfig>;
export type LeaderboardSource = S.Schema.Type<typeof LeaderboardSource>;
export type CompetitionConfig = S.Schema.Type<typeof CompetitionConfig>;
export type Extendable = S.Schema.Type<typeof Extendable>;
export type TrackConfig = S.Schema.Type<typeof TrackConfig>;

export const decode = S.decodeUnknown(Config, { onExcessProperty: "preserve" });
