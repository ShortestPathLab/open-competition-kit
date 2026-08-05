/**
 * Normalising every `with:` list in the config, and applying the packages an
 * organiser does not have to ask for.
 *
 * One step, run once, in the place both readers of a `with:` list derive from.
 * `walkNodes` seeds the validator and the config editor from the root list, and
 * `propagateExtendable` seeds the runtime chain from the same place, so anything
 * done here is seen by all three without a second mechanism.
 *
 * Two jobs, and they belong together because both are about what the list holds
 * before anybody reads it.
 *
 * Canonicalising, because `withAt` deduplicates with `uniq` over raw strings.
 * `./x` at the root and `local:./x` on a track are one package written twice, and
 * left alone they join the chain twice and contribute their config fields twice.
 *
 * Defaults, because the packages listed below are in every configuration that
 * works and there is nothing for an organiser to decide by typing them out. They
 * are prepended rather than appended: the last entry in `with:` is outermost,
 * `noop` has to stay innermost to terminate a chain, and the rest have to stay
 * inside anything an organiser installs so their own packages can wrap them.
 */
import { FileSystem, Path } from "@effect/platform";
import { Effect as E } from "effect";
import { canonicalise, isPackageUriError, type PackageRef } from "../package/uri";

/**
 * Applied to every configuration, without being written in one.
 *
 * Named as npm packages rather than as paths, which is why this could not exist
 * before the schemes did: core cannot depend on any of them, since they all depend
 * on the SDK which depends on core, and `publish.sh` publishes strictly
 * dependencies first with versions pinned from the lockfile.
 *
 * The bar for being on this list is narrow, and it is not "useful enough". A
 * package here declares no config vocabulary at all, because behaviour can be
 * overridden by position in the chain and vocabulary cannot: there is no way to
 * un-declare a field, so a default that declared one would make every
 * configuration answer to it forever. That is the whole reason `standard` no
 * longer holds the gates, and why the ordering below reads noop, then a machine,
 * then the submission workflow.
 */
export const DEFAULT_PACKAGES: readonly string[] = [
  "npm:@open-competition-kit/noop",
  "npm:@open-competition-kit/machine-local",
  "npm:@open-competition-kit/standard",
];

const isNode = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * What a package calls itself, so a default can tell that it is already installed.
 *
 * An organiser working on a checkout writes `./packages/packages/noop`, which is
 * the same package as `npm:@open-competition-kit/noop` and canonicalises to a
 * different uri. Prepending the default anyway would put `noop` in the chain
 * twice, and failing to find it in the package cache would stop a service that was
 * working perfectly well a moment ago.
 *
 * Reading the name off `package.json` is exact where matching uris is not. A local
 * directory that has no name simply does not suppress anything.
 */
const declaredName = (ref: PackageRef) =>
  E.gen(function* () {
    if (ref.scheme !== "local") return ref.id;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const manifest = yield* fs.readFileString(path.join(ref.id, "package.json")).pipe(
      E.map((text) => JSON.parse(text) as { name?: string }),
      E.orElseSucceed(() => ({}) as { name?: string }),
    );
    return manifest.name;
  });

export class WithListError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Some \`with:\` entries could not be read:\n${problems.map((p) => `  ${p}`).join("\n")}`);
  }
}

/**
 * Every `with:` in the tree, canonicalised, with the defaults applied at the root.
 *
 * Works on the config in place, which is what the rest of the loading pipeline
 * already does with the decoded value.
 */
export const applyWith = (
  config: Record<string, unknown>,
  options: { cwd: string; defaults?: readonly string[] },
) =>
  E.gen(function* () {
    const path = yield* Path.Path;
    const problems: string[] = [];
    const resolveLocal = (p: string) => path.resolve(options.cwd, p);

    const canonicaliseList = (entries: readonly unknown[]) => {
      const uris: string[] = [];
      for (const entry of entries) {
        if (typeof entry !== "string") {
          problems.push(`\`${JSON.stringify(entry)}\` is not a package name.`);
          continue;
        }
        const ref = canonicalise(entry, resolveLocal);
        if (isPackageUriError(ref)) problems.push(`\`${entry}\`: ${ref.message}`);
        else if (!uris.includes(ref.uri)) uris.push(ref.uri);
      }
      return uris;
    };

    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!isNode(node)) return;
      if (Array.isArray(node.with)) node.with = canonicaliseList(node.with);
      for (const value of Object.values(node)) walk(value);
    };
    walk(config);

    const authored = Array.isArray(config.with) ? (config.with as string[]) : [];

    // Names, not uris: an entry pointing at a checkout of a default is that
    // default, however it was spelled.
    const installed = new Set(
      (yield* E.all(
        authored.map((uri) => {
          const ref = canonicalise(uri, resolveLocal);
          return isPackageUriError(ref) ? E.succeed(undefined) : declaredName(ref);
        }),
      )).filter((name): name is string => typeof name === "string"),
    );

    const all = options.defaults ?? DEFAULT_PACKAGES;
    // Matched on the name rather than the uri, so both `@open-competition-kit/standard`
    // and `npm:@open-competition-kit/standard` work. One of them is what an
    // organiser would think to write and there is no reading of the other that
    // means something different.
    const nameOf = (uri: string) => uri.trim().replace(/^npm:/, "");
    const dropped = (Array.isArray(config.without) ? config.without : []).map(String);

    // A `without:` naming something that is not a default is a typo, and every
    // other unrecognised key in this config is fatal.
    for (const entry of dropped) {
      if (!all.some((uri) => nameOf(uri) === nameOf(entry))) {
        problems.push(
          `\`without: ${entry}\` names something that is not a default package. ` +
            `The defaults are ${all.map(nameOf).join(" and ")}.`,
        );
      }
    }

    if (problems.length > 0) return yield* E.fail(new WithListError(problems));

    const defaults = all.filter(
      (uri) =>
        !installed.has(nameOf(uri)) && !dropped.some((entry) => nameOf(entry) === nameOf(uri)),
    );

    config.with = [...defaults, ...authored];
    return config;
  });
