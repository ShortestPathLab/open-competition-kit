/**
 * Checking the whole config against the packages installed on it.
 *
 * Core's own decode has already run by the time this does, so what is left are
 * the fields core does not declare. Every one of them has to belong to a package
 * the organiser installed at that point in the tree, and this is where that is
 * decided.
 *
 * Two ordering constraints, both load-bearing. It runs *after* `transform`, so a
 * `${{ env("...") }}` in a package field is resolved before anybody validates
 * it. And it runs *before* `propagateExtendable`, which stamps a `with` key onto
 * every object it walks: validating afterwards would mean every node in the
 * config carrying a field no package declared.
 */
import { Effect as E } from "effect";
import {
  CompetitionConfig,
  Config,
  DbNode,
  FilesNode,
  FormFieldNode,
  FormNode,
  LeaderboardNode,
  MachineNode,
  RENAMED_FIELDS,
  RunnerNode,
  TrackNode,
} from "./schema";
import {
  extensionsOf,
  validateNode,
  type ConfigExtensionError,
  type NodeKind,
  type ResolvedExtension,
} from "./extension";
import { walkNodes, type Node } from "./walk";

/**
 * What core itself declares at each node kind.
 *
 * Read off the schema rather than listed by hand, so a field added to `Config`
 * cannot become an unrecognised field here. `db`, `files` and `machine` declare
 * nothing at all, which is the point of them: every key inside belongs to
 * whichever package implements that backend, and a key no installed package
 * claims is an error rather than a setting quietly doing nothing.
 */
export const CORE_KEYS: Record<NodeKind, readonly string[]> = {
  root: Object.keys(Config.fields),
  competition: Object.keys(CompetitionConfig.fields),
  track: Object.keys(TrackNode.fields),
  form: Object.keys(FormNode.fields),
  formField: Object.keys(FormFieldNode.fields),
  leaderboard: Object.keys(LeaderboardNode.fields),
  runner: Object.keys(RunnerNode.fields),
  db: Object.keys(DbNode.fields),
  files: Object.keys(FilesNode.fields),
  machine: Object.keys(MachineNode.fields),
};

export type Resolve<R = never> = (specifier: string) => E.Effect<unknown, unknown, R>;

/**
 * The extensions contributed at one point in the tree, by kind.
 *
 * A package that fails to import contributes nothing rather than taking the
 * whole config down. That matches how the resolver already behaves, and the
 * failure is loud in the log either way: an integration that cannot load is a
 * broken integration, not a broken competition.
 */
export const collectExtensions = <R>(installed: readonly string[], resolve: Resolve<R>) =>
  E.gen(function* () {
    const byKind = new Map<NodeKind, ResolvedExtension[]>();
    const unloadable: string[] = [];

    for (const specifier of installed) {
      const module = yield* resolve(specifier).pipe(E.catchAll(() => E.succeed(undefined)));
      // Told apart from a package that loaded and simply declares no config, so
      // that an unrecognised field can point at the import that never happened
      // rather than at the organiser's spelling.
      if (module === undefined) {
        unloadable.push(specifier);
        continue;
      }
      for (const [kind, extension] of Object.entries(extensionsOf(module, specifier))) {
        const list = byKind.get(kind as NodeKind) ?? [];
        list.push(extension as ResolvedExtension);
        byKind.set(kind as NodeKind, list);
      }
    }

    return { byKind, unloadable };
  });

export type ValidateConfigOptions<R = never> = {
  /** Imports a `with:` entry and hands back its default export. */
  resolve: Resolve<R>;
  /** Whether a field no installed package claims is an error. Default true. */
  strict?: boolean;
};

/**
 * Validate every extendable node, writing coerced values back in place.
 *
 * Generic in the resolver's requirements rather than demanding `never`, because
 * the real resolver reads `Path` from the environment and a caller that has one
 * should not have to launder it away to use this.
 *
 * Works on a copy. The walk yields live references so that a package schema that
 * normalises a value (an ISO instant out of a YAML timestamp) can have its work
 * kept, and rewriting the caller's own object as a side effect of checking it
 * would be a surprise.
 */
export const validateConfig = <R = never>(
  config: Node,
  options: ValidateConfigOptions<R>,
): E.Effect<Node, ConfigExtensionError, R> =>
  E.gen(function* () {
    const strict = options.strict ?? true;
    const copy = structuredClone(config) as Node;

    for (const { node, kind, path, installed } of walkNodes(copy)) {
      const { byKind, unloadable } = yield* collectExtensions(installed, options.resolve);
      const checked = yield* validateNode(node, {
        kind,
        path,
        coreKeys: CORE_KEYS[kind],
        renamed: RENAMED_FIELDS[kind],
        extensions: byKind.get(kind) ?? [],
        unloadable,
        strict,
      });
      Object.assign(node, checked);
    }

    return copy;
  });
