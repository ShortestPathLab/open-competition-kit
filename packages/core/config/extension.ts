/**
 * Config fields that packages own.
 *
 * Core describes the skeleton of a competition: it has tracks, a track takes
 * submissions through a form, a competition has leaderboards. What it should not
 * describe is any particular rule about those things. A deadline, an attempt
 * ceiling, a Prisma connection string and an S3 bucket are all somebody's
 * implementation, and a package that implements them should be able to declare
 * the fields it reads without a core release.
 *
 * A package contributes a schema per node kind. The schema decides validity; the
 * optional `shape` describes the same fields to a config editor, in the same
 * vocabulary a submission form uses. Both are collected at boot, so an organiser
 * finds out about a misspelled field when the app starts rather than when the
 * deadline silently fails to fire.
 */
import { Data, Effect as E } from "effect";
import type { Meta, Shape } from "../common/shape";

/**
 * The validation contract, as published by the Standard Schema spec.
 *
 * Declared here rather than depended on, which is what the spec is for: it is an
 * interface, not a library. Core validates with Effect, `standard` and the
 * integrations validate with Zod, and neither has to adopt the other's schema
 * library to contribute a field.
 */
export type StandardSchemaV1<Output = unknown> = {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => StandardResult<Output> | Promise<StandardResult<Output>>;
  };
};

export type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly StandardIssue[] };

export type StandardIssue = {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[];
};

export const isStandardSchema = (value: unknown): value is StandardSchemaV1 =>
  typeof value === "object" &&
  value !== null &&
  "~standard" in value &&
  typeof (value as StandardSchemaV1)["~standard"]?.validate === "function";

/**
 * A place in the config a package may add fields to.
 *
 * Named by what the node *is* rather than by where it sits, so a package says
 * "I add fields to a track" and never has to know that a track is reached
 * through `competitions[].tracks[]`. The mapping from path to kind is core's
 * business and lives in `NODES` below.
 *
 * The three leaf kinds (`db`, `largeFiles`, `sandbox`) are whole config blocks
 * that core declares the existence of and nothing about the contents of. Before
 * this existed they were typed as "a record of anything", which is a comment
 * about validation being skipped rather than a description of a shape.
 *
 * `auth` is deliberately absent. It is the same sort of block, but it is parsed
 * inside the UI service and there is no auth package to move it to, so adding a
 * kind for it would advertise an extension point that nothing ever reads.
 */
export type NodeKind =
  | "root"
  | "competition"
  | "track"
  | "form"
  | "formField"
  | "leaderboard"
  | "runner"
  | "db"
  | "largeFiles"
  | "sandbox";

/**
 * What a package adds to one node kind.
 *
 * `schema` is the only required part, because validating is the point and a
 * package that only wants its fields checked should not have to describe them
 * twice. `shape` and `group` exist for the config editor, which needs things a
 * validation schema has no vocabulary for: what order fields go in, what to call
 * them, and which ones belong together on screen.
 */
export type ConfigExtension = {
  /** Decides validity. Also normalises, so a coerced value is written back. */
  schema: StandardSchemaV1;
  /**
   * The same fields as an editor sees them, in display order. Advisory: a
   * package that omits this still validates, and an editor falls back to the
   * field names the schema accepted.
   */
  shape?: readonly (Shape & Meta)[];
  /** A section to gather these fields under, e.g. "Submission gates". */
  group?: { id: string; label: string };
};

export type ConfigExtensions = Partial<Record<NodeKind, ConfigExtension>>;

/** One package's contribution, kept next to the name that made it. */
export type ResolvedExtension = ConfigExtension & {
  /** The `with:` entry that produced it, which is what an error should name. */
  source: string;
};

export class ConfigExtensionError extends Data.TaggedError(
  "ConfigExtensionError",
)<{
  /** Dotted path to the offending node, e.g. `competitions.fit5047.tracks.main`. */
  path: string;
  kind: NodeKind;
  /** The whole sentence, path included. Composed by `fail` below. */
  message: string;
  /** The sentence on its own, for a caller that lays the path out itself. */
  detail: string;
}> {}

/**
 * Read the extensions off a package module.
 *
 * Taken from the module rather than from the merged hooks on purpose. `Hooks` is
 * decoded with excess properties dropped, so a `config` key declared there would
 * vanish; and hook merging composes functions, which would deep-merge two
 * schemas into something that is neither. A schema is data about the package,
 * so it is read the same way `name` and `version` are.
 */
export const extensionsOf = (
  module: unknown,
  source: string,
): Partial<Record<NodeKind, ResolvedExtension>> => {
  const declared = (module as { config?: unknown } | undefined)?.config;
  if (typeof declared !== "object" || declared === null) return {};

  const out: Partial<Record<NodeKind, ResolvedExtension>> = {};
  for (const [kind, extension] of Object.entries(declared)) {
    if (typeof extension !== "object" || extension === null) continue;
    const schema = (extension as ConfigExtension).schema;
    if (!isStandardSchema(schema)) continue;
    out[kind as NodeKind] = {
      ...(extension as ConfigExtension),
      source,
    };
  }
  return out;
};

const formatIssue = (issue: StandardIssue) => {
  const path = (issue.path ?? [])
    .map((segment) =>
      typeof segment === "object" ? String(segment.key) : String(segment),
    )
    .join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
};

/**
 * Run one schema over one node.
 *
 * Returns the keys the schema claimed as well as the value it produced. The keys
 * matter twice over: they are how two packages fighting over one field name are
 * caught, and how a field nobody declared is told apart from one that simply was
 * not set. A Standard Schema has no introspection API, so the claim is read off
 * what the validated output kept, which every implementation that strips unknown
 * properties reports correctly.
 */
const runSchema = (extension: ResolvedExtension, node: Record<string, unknown>) =>
  E.gen(function* () {
    const raw = extension.schema["~standard"].validate(node);
    const result = yield* (
      raw instanceof Promise ?
        E.promise(() => raw)
      : E.succeed(raw)
    );

    if (result.issues) {
      return yield* E.fail(
        result.issues.map(formatIssue).join("; ") || "invalid",
      );
    }

    const value = (result.value ?? {}) as Record<string, unknown>;
    // Only keys the caller actually wrote. A schema fills in defaults for keys
    // that were absent, and claiming those would let one package's default
    // silently satisfy another package's required field.
    const claimed = Object.keys(value).filter((key) => key in node);
    return { value, claimed };
  });

/**
 * `with` is stamped onto every object by `propagateExtendable`, and each
 * extendable node carries an authored one besides. Neither belongs to a package,
 * and a node whose only extra key is `with` is not an error.
 */
const RESERVED = new Set(["with"]);

export type ValidateNodeOptions = {
  /** Which node this is, for the error message and the extension lookup. */
  kind: NodeKind;
  /** Dotted path, for the error message. */
  path: string;
  /** Keys core's own schema declares here. */
  coreKeys: readonly string[];
  /** Extensions contributed by the packages installed at this node. */
  extensions: readonly ResolvedExtension[];
  /**
   * Packages listed in `with:` here that could not be imported.
   *
   * They contribute nothing, so their fields look unrecognised. Naming them is
   * what keeps the error pointed at the real problem: an organiser told that
   * `url` is misspelled will go and check the spelling of `url`, and the actual
   * cause is that the package which owns it never loaded.
   */
  unloadable?: readonly string[];
  /**
   * Whether a key nobody claimed is an error.
   *
   * On by default. Before packages could declare fields, an unrecognised key was
   * preserved and silently ignored, which meant a typo in `closesAt` produced a
   * track that never closed and no indication of why.
   */
  strict: boolean;
};

/**
 * Validate one node against every package that added fields to it.
 *
 * Returns the node with coerced values written back, so a package schema that
 * normalises (an ISO instant out of a YAML timestamp, say) has its work kept.
 */
export const validateNode = (
  node: Record<string, unknown>,
  options: ValidateNodeOptions,
) =>
  E.gen(function* () {
    // The path leads the sentence rather than being carried alongside it. An
    // organiser reads this out of a crashed boot log, where the field they got
    // wrong is useless without knowing which of forty tracks it is on.
    const fail = (detail: string) =>
      new ConfigExtensionError({
        path: options.path,
        kind: options.kind,
        detail,
        message: `${options.path}: ${detail}`,
      });

    const value: Record<string, unknown> = { ...node };
    const claimedBy = new Map<string, string>();

    for (const extension of options.extensions) {
      const result = yield* runSchema(extension, node).pipe(
        E.mapError((message) => fail(`${extension.source} rejected it. ${message}`)),
      );

      for (const key of result.claimed) {
        const existing = claimedBy.get(key);
        if (existing && existing !== extension.source) {
          return yield* fail(
            `"${key}" is claimed by both ${existing} and ${extension.source}. ` +
              `Only one package may own a field. Ask one of them to namespace ` +
              `it, e.g. "${extension.source.split("/").pop()}:${key}".`,
          );
        }
        claimedBy.set(key, extension.source);
        value[key] = result.value[key];
      }
    }

    if (options.strict) {
      const known = new Set([...options.coreKeys, ...claimedBy.keys()]);
      const unknown = Object.keys(node).filter(
        (key) => !known.has(key) && !RESERVED.has(key),
      );

      if (unknown.length) {
        const named = unknown.map((key) => `"${key}"`).join(", ");
        const fields = unknown.length === 1 ? "field" : "fields";

        // An import failure is the likelier explanation and the more urgent one,
        // so it goes first and the spelling advice is dropped entirely. A
        // package that did not load has taken its hooks with it, and telling
        // somebody to check their spelling would send them the wrong way.
        if (options.unloadable?.length) {
          return yield* fail(
            `unrecognised ${fields} ${named}, but ` +
              `${options.unloadable.join(", ")} failed to import and so ` +
              `declared nothing. Fix that first: a package that cannot load ` +
              `has taken its hooks with it, and the error above this one says ` +
              `why it could not be found.`,
          );
        }

        const consulted =
          options.extensions.length ?
            options.extensions.map((e) => e.source).join(", ")
          : "none";

        return yield* fail(
          `unrecognised ${fields} ${named}. ` +
            `Core declares ${options.coreKeys.join(", ") || "nothing"} here, ` +
            `and the packages installed at this node declare nothing else ` +
            `(consulted: ${consulted}). Check the spelling, or install the ` +
            `package that provides the field.`,
        );
      }
    }

    return value;
  });
