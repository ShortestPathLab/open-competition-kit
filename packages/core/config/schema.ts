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
 * Core no longer has a field of its own with this type. It stays here, and stays
 * exported, because a package that declares a scheduled field needs exactly this
 * behaviour and the reasoning above is not obvious enough to rediscover. The Zod
 * equivalent in `@open-competition-kit/standard` exists for the same reason.
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

/**
 * One field on a submission form.
 *
 * `kind` is an open string on purpose: `github:ref-select` is provided by the
 * GitHub integration and core has never heard of it. A package that provides a
 * field kind may declare the extra properties that kind accepts by contributing
 * a `formField` extension.
 */
export const FormFieldNode = S.Struct({ ...Shape.fields, ...Meta.fields });

export const FormConfig = S.Struct({
  ...Meta.fields,
  shape: S.Array(FormFieldNode),
});

export const FormNode = S.Struct({
  ...Extendable.fields,
  ...FormConfig.fields,
});

/**
 * A leaderboard, as core understands one: a heading, a set of columns, and
 * optionally some literal rows.
 *
 * Where computed rows come from is not core's business. `standard` contributes a
 * `from:` block describing how it reads job outputs, and a package that sources
 * rows some other way contributes its own. Core knows only that a loader turns
 * this definition into `items`.
 */
export const LeaderboardConfig = S.Struct({
  ...Meta.fields,
  shape: S.Array(Shape),
  /** Literal rows. Used when no loader produces any — handy for demos and static boards. */
  items: S.optional(S.Array(S.Record({ key: S.String, value: Value }))),
  /** Renderer-specific settings, passed through to whichever package draws this board. */
  options: S.optional(S.Record({ key: S.String, value: S.Any })),
});

export const LeaderboardNode = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  ...LeaderboardConfig.fields,
});

/**
 * How submissions to a track get evaluated.
 *
 * Core declares that a track's competition has a runner and which packages are
 * installed on it, and stops there. What a runner is configured *with* is the
 * runner package's own vocabulary: `standard` takes a `body:` of JavaScript, and
 * a package that runs a container image or a workflow graph would take neither.
 */
export const RunnerNode = S.Struct({ ...Extendable.fields });

export const TrackNode = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  description: S.optional(S.String),
  overview: S.optional(S.String),
  rules: S.optional(S.String),
  form: FormNode,
});

export const TrackConfig = TrackNode;

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
  runner: RunnerNode,
  leaderboards: S.Array(LeaderboardNode),
});

/**
 * A block core declares the existence of and nothing else about.
 *
 * The package that implements the matching hooks declares the contents. An empty
 * struct rather than a record of anything, so that every key inside is unclaimed
 * until some installed package claims it, and a misspelled one is an error at
 * boot instead of a default silently taking over at runtime.
 */
export const DbNode = S.Struct({});

/**
 * Where large files go, as far as core is concerned.
 *
 * Only the ceiling. Core rejects an upload past `maxBytes` before it reaches any
 * backend, so the field has to be readable without knowing which backend is
 * installed. Everything else about storage — a filesystem root, a bucket, a set
 * of credentials — belongs to whichever package moves the bytes.
 */
export const LargeFilesNode = S.Struct({
  /** Largest upload core will accept, in bytes. */
  maxBytes: S.optional(S.Number.pipe(S.positive())),
});

/**
 * Confinement defaults for whichever package implements the `sandbox` hooks.
 *
 * An organiser's ceiling, not a runner's preference: a runner may ask for less
 * than this but never for more, so one careless package cannot hand a stranger
 * the whole machine. Core applies these itself before calling the hook, which is
 * the reason they are declared here rather than left to the sandbox package: a
 * package cannot be trusted to enforce the limit that exists to contain it.
 */
export const SandboxNode = S.Struct({
  /** Wall-clock limit per run. */
  timeoutMs: S.optional(S.Number.pipe(S.positive())),
  memoryMb: S.optional(S.Number.pipe(S.positive())),
  /** Process cap. Without one, a fork bomb takes the host down. */
  pids: S.optional(S.Number.pipe(S.int(), S.positive())),
});

export const Config = S.Struct({
  appName: S.String,
  appDescription: S.String,
  auth: S.Record({ key: S.String, value: S.Any }),
  competitions: S.Array(CompetitionConfig),
  /** Connection settings for whichever package implements the `db` hooks. */
  db: DbNode,
  secrets: S.optional(S.Record({ key: S.String, value: S.String })),
  /**
   * Email addresses permitted to reach the organiser dashboard. Absent or empty
   * means nobody can — the dashboard fails closed, since an unguarded admin
   * surface is worse than an unreachable one.
   */
  admins: S.optional(S.Array(S.String)),
  largeFiles: S.optional(LargeFilesNode),
  sandbox: S.optional(SandboxNode),
  ...Extendable.fields,
});

export type Config = S.Schema.Type<typeof Config>;
export type Form = S.Schema.Type<typeof FormConfig>;
export type Leaderboard = S.Schema.Type<typeof LeaderboardConfig>;
export type CompetitionConfig = S.Schema.Type<typeof CompetitionConfig>;
export type Extendable = S.Schema.Type<typeof Extendable>;
export type TrackConfig = S.Schema.Type<typeof TrackConfig>;

/**
 * Excess properties are preserved because most of them belong to somebody: a
 * package declares them through a `config` extension, and `validateConfig` runs
 * straight after this to check them against whoever declared them. A key that no
 * installed package claims is rejected there, where the error can name which
 * packages were asked.
 */
export const decode = S.decodeUnknown(Config, { onExcessProperty: "preserve" });
