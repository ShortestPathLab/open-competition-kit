import { Schema as S } from "effect";
import { Meta, Shape } from "../hook";
import { Item, Value } from "../common/shape";

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
  form: S.Struct({ ...Extendable.fields, ...FormConfig.fields }),
});

export const CompetitionConfig = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
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
