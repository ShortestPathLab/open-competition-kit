import { ParseResult, Schema as S } from "effect";
// Straight from where these are defined, not through the `../hook` barrel that
// re-exports them. That barrel imports this package's own index, which imports
// `validate`, which reads `Config.fields` at module scope: importing it from
// here closes a cycle, and whichever module happens to load first crashes with
// "Cannot access 'Config' before initialization".
import { Item, Meta, Shape, Value } from "../common/shape";

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
export const Timestamp = S.transformOrFail(S.Union(S.String, S.DateFromSelf), S.String, {
  strict: true,
  decode: (input, _options, ast) => {
    const parsed = input instanceof Date ? input : new Date(input);
    return Number.isNaN(parsed.getTime())
      ? ParseResult.fail(
          new ParseResult.Type(
            ast,
            input,
            `Expected an ISO 8601 date-time, got ${JSON.stringify(input)}`,
          ),
        )
      : ParseResult.succeed(parsed.toISOString());
  },
  encode: (value) => ParseResult.succeed(value),
});

/**
 * A node packages can be installed on.
 *
 * `with` may be left out, and leaving it out is the common case: most nodes
 * install nothing of their own and want whatever was listed above them, which
 * `propagateExtendable` hands down regardless. Requiring it meant an organiser
 * writing `with: []` on every competition, track, form, runner and leaderboard
 * to say nothing at all.
 *
 * An absent list decodes to an empty one rather than to `undefined`, so
 * everything downstream still reads `node.with` without asking whether anybody
 * wrote it. `nullable` is on because a bare `with:` in YAML resolves to null,
 * and somebody who left the key with nothing under it meant the same thing as
 * somebody who left the key out.
 */
export const Extendable = S.Struct({
  with: S.optionalWith(S.Array(S.String), {
    default: () => [] as string[],
    nullable: true,
  }),
});

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
  /**
   * What this board should look like.
   *
   * An open string, for the same reason a form field's `kind` is one: `card` and
   * `chart` are supplied by leaderboard packages and core has never heard of
   * either. Each installed renderer answers for the kinds it knows and passes the
   * rest inward, so this picks between them without the board having to install a
   * package of its own.
   *
   * Absent means whatever a renderer offers as its default look.
   */
  kind: S.optional(S.String),
  /** Literal rows. Used when no loader produces any, which suits demos and static boards. */
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
 * runner package's own vocabulary: `runner-script` takes a `command:` and the
 * files to run it against, and a package that dispatches to a workflow graph or
 * a hosted evaluation service would take neither.
 *
 * Nothing here means a competition with no runner package installed stores
 * submissions and scores none of them, which is a working state to write a
 * competition in and not one to open it in.
 */
export const RunnerNode = S.Struct({ ...Extendable.fields });

/**
 * A picture, written as anything an `<img src>` accepts.
 *
 * An ordinary `https://` URL works, and so does `dataUrl("./assets/icon.png")`,
 * which reads the file next to the config and inlines it. Inlining is the one
 * worth reaching for first: the picture is then versioned with the competition
 * that uses it and survives whatever happens to the host it came from.
 *
 * Unvalidated beyond being a string, because there is nothing useful to check.
 * A URL that resolves to nothing and a URL that resolves to a photograph of
 * somebody's lunch are both well-formed, and neither can be told apart from a
 * good one without fetching it.
 */
const Picture = S.String;

export const TrackNode = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  /**
   * The track's own picture, shown wherever the track is named beside one: its
   * card in a list, and the header of its page.
   *
   * Absent, the track keeps the pattern generated from its id, which is stable
   * and distinct without an organiser having to draw anything.
   */
  icon: S.optional(Picture),
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
  /**
   * The competition's picture, shown wherever it is named beside one: its card
   * on the index, its own header, and the competitions somebody has entered.
   *
   * Absent, it keeps the pattern generated from its name.
   */
  icon: S.optional(Picture),
  /**
   * The picture painted behind the top of every page in this competition, from
   * the navigation bar down through the header.
   *
   * Wide rather than square: what is shown is a horizontal band through the
   * middle of it, as wide as the window, so anything that has to be seen belongs
   * near the centre. Whether the header takes light or dark ink is worked out
   * from the picture rather than from the reader's theme, so a dark banner keeps
   * its light text on a site somebody is reading in daylight.
   *
   * A banner given as a remote URL is drawn but may not be readable: working the
   * ink out means reading the pixels back, which a host that sends no
   * `access-control-allow-origin` forbids, and the header falls back to light
   * ink on the assumption the picture is dark. `dataUrl()` has no such problem.
   */
  banner: S.optional(Picture),
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
 * Where files go, as far as core is concerned.
 *
 * Nothing, which is the whole of what core knows about storage. A root
 * directory, a bucket, a set of credentials and the size a backend is willing to
 * accept are all the same kind of thing: settings for whichever package moves
 * the bytes, and unreadable without knowing which package that is.
 *
 * Named for the hooks it configures, like every other block. It was `largeFiles`
 * for as long as it held a ceiling that only large files ever met; the backend
 * behind it stores a forty byte text file the same way it stores a model.
 *
 * The ceiling used to be declared here on the grounds that core is what refuses
 * an oversized upload. It still refuses one, but it asks the backend for the
 * figure rather than reading it, so the field can live with the rest of the
 * backend's settings and be labelled and validated alongside them.
 */
export const FilesNode = S.Struct({});

/**
 * Confinement settings for whichever package implements the `machine` hooks.
 *
 * Declared by that package, not here. Core hands numbers to a machine and has no
 * way to check that any of them were applied, so a ceiling held in core would be
 * a ceiling only the machine could choose to honour. The package that does the
 * confining is the one that declares what it can be told, and the one that
 * clamps a greedy runner against it.
 *
 * The gain from that arrangement is that an ignored setting stops being silent:
 * write `memoryMb` with a machine that does not declare it and the app refuses
 * to start, naming the packages that were asked. It is also what makes the local
 * machine in `standard` honest, since it declares almost nothing and so cannot
 * be told to enforce what it has no way to enforce.
 */
export const MachineNode = S.Struct({});

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
  files: S.optional(FilesNode),
  machine: S.optional(MachineNode),
  /**
   * Default packages to leave out. Root only, and the only thing it may name is a
   * default, since everything else is already absent unless `with:` asks for it.
   *
   * A list rather than a flag, because dropping `standard` to replace the whole
   * submission workflow while keeping `noop` at the bottom of the chain is the
   * case worth supporting, and a flag would make somebody re-list `noop` by hand
   * to get it.
   */
  without: S.optional(S.Array(S.String)),
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
