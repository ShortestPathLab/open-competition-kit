/**
 * The one place a package is turned into a running thing, and the only place that
 * holds one.
 *
 * Three callers reach for a package independently: config validation wants its
 * field schemas, the config editor wants their labels, and the hook chain wants
 * its implementations. Each used to build its own resolver. That was harmless
 * while loading a package meant importing a module, because a second import of the
 * same absolute specifier comes back out of the runtime's own module registry.
 *
 * It stops being harmless the moment a loader owns a process. Nothing deduplicates
 * process startup, so the same package would be started once for its schemas and
 * again for its hooks, and `stop` would have no owner and nowhere to be called
 * from. Memoising here, on the canonical uri, is what makes the loader interface
 * implementable rather than merely tidier.
 */
import { FileSystem, Path } from "@effect/platform";
import { Data, Effect as E } from "effect";
import { cacheDirFor, cacheRoot, RECORD_FILE, type InstalledRecord } from "./cache";
import { LoadError, loaderFor, type Loaded } from "./loader";
import { canonicalise, isPackageUriError, parseRef, type PackageRef } from "./uri";

export class PackageNotInstalledError extends Data.TaggedError("PackageNotInstalledError")<{
  uri: string;
  expected: string;
}> {
  override get message() {
    return (
      `${this.uri} is not in the package cache. It was expected at ${this.expected}. ` +
      `Run the install step before starting a service: nothing is fetched at boot, ` +
      `so a registry having a bad morning cannot stop a competition that is already running.`
    );
  }
}

/** A directory holding a package, and what to import inside it when that differs. */
export type Materialised = { dir: string; entry?: string };

export class OpenCompetitionKitPackages extends E.Service<OpenCompetitionKitPackages>()(
  "open-competition-kit/Packages",
  {
    effect: E.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* cacheRoot;

      /**
       * A local entry may name a directory or a file. A directory is imported as
       * itself, so `package.json` decides the entry point; a file is imported
       * directly, and its directory is what a loader is shown.
       */
      const materialise = (ref: PackageRef) =>
        E.gen(function* () {
          if (ref.scheme === "local") {
            const isDirectory = yield* fs.stat(ref.id).pipe(
              E.map((info) => info.type === "Directory"),
              E.orElseSucceed(() => true),
            );
            return isDirectory
              ? ({ dir: ref.id } satisfies Materialised)
              : ({
                  dir: path.dirname(ref.id),
                  entry: path.basename(ref.id),
                } satisfies Materialised);
          }

          // The record rather than the directory, because where a package landed
          // is the installer's answer: a github ref is installed under whatever
          // name its own `package.json` declares, which `org/repo` does not say.
          const cached = cacheDirFor(root, ref);
          const record = yield* fs.readFileString(path.join(cached, RECORD_FILE)).pipe(
            E.map((text) => JSON.parse(text) as InstalledRecord),
            E.orElseSucceed(() => undefined),
          );
          if (!record) {
            return yield* E.fail(new PackageNotInstalledError({ uri: ref.uri, expected: cached }));
          }
          return { dir: record.dir } satisfies Materialised;
        });

      const started = new Map<string, Loaded>();

      const start = (ref: PackageRef) =>
        E.gen(function* () {
          const existing = started.get(ref.uri);
          if (existing) return existing;

          const { dir, entry } = yield* materialise(ref);
          const { loader, manifest } = yield* loaderFor(dir, ref);
          const loaded = yield* loader.start(dir, ref, {
            ...manifest,
            ...(entry ? { entry } : {}),
          });
          started.set(ref.uri, loaded);
          return loaded;
        });

      /**
       * The platform services this service already holds, handed to the effects
       * it gives out.
       *
       * Without this every caller of `load` inherits a `FileSystem` requirement,
       * and the `kit` proxy in the SDK only unwraps an effect whose requirements
       * are `never`. One leak there turns every hook call in the product into a
       * value typed as an unrun effect.
       */
      const discharge = <A, Err>(
        effect: E.Effect<A, Err, FileSystem.FileSystem | Path.Path>,
      ): E.Effect<A, Err> =>
        effect.pipe(E.provideService(FileSystem.FileSystem, fs), E.provideService(Path.Path, path));

      const refOf = (uri: string) => {
        // Canonical by the time it arrives, so a local path is already absolute
        // and there is nothing left to resolve it against.
        const ref = parseRef(uri);
        return isPackageUriError(ref)
          ? E.fail(new LoadError({ uri, message: ref.message }))
          : E.succeed(ref);
      };

      return {
        /** The default export of the package this uri names. */
        load: (uri: string) =>
          discharge(
            refOf(uri).pipe(
              E.flatMap(start),
              E.map((loaded) => loaded.module),
            ),
          ),

        /**
         * Every uri resolved once, before anything asks what a package contains.
         *
         * Config validation deliberately treats a package that will not load as one
         * contributing no fields, on the reasoning that a broken integration is not a
         * broken competition. Correct there, and it means a package missing from the
         * cache that happens to declare no config fields would sail through config
         * loading and surface much later as a chain quietly one link short. This is
         * where that is caught, and it reports every failure at once rather than the
         * first.
         */
        preflight: (uris: readonly string[]) =>
          discharge(
            E.gen(function* () {
              const failures: string[] = [];
              for (const uri of uris) {
                yield* refOf(uri).pipe(
                  E.flatMap(start),
                  E.catchAll((error) =>
                    E.sync(() => {
                      failures.push(`  ${uri}: ${error.message}`);
                    }),
                  ),
                );
              }
              if (failures.length > 0) {
                return yield* E.fail(
                  new LoadError({
                    uri: uris.join(", "),
                    message: `${failures.length} package(s) could not be loaded:\n${failures.join("\n")}`,
                  }),
                );
              }
            }),
          ),

        /** Releases every loader that holds something. */
        stopAll: () =>
          E.promise(async () => {
            const loaded = [...started.values()];
            started.clear();
            await Promise.allSettled(loaded.map((one) => one.stop?.()));
          }),
      };
    }),
  },
) {}

/**
 * Canonicalising a `with:` list, given where the config was found.
 *
 * Applied to the entries themselves rather than inside the resolver, because
 * `withAt` deduplicates raw strings: two spellings of one package survive it as
 * two entries, and by the time a memo could tell they were the same, the package
 * is already in the chain twice.
 */
export const canonicaliseWith = (
  entries: readonly string[],
  cwd: string,
  path: Path.Path,
): { uris: string[]; errors: string[] } => {
  const uris: string[] = [];
  const errors: string[] = [];
  for (const entry of entries) {
    const ref = canonicalise(entry, (p) => path.resolve(cwd, p));
    if (isPackageUriError(ref)) errors.push(`\`${entry}\`: ${ref.message}`);
    else if (!uris.includes(ref.uri)) uris.push(ref.uri);
  }
  return { uris, errors };
};
