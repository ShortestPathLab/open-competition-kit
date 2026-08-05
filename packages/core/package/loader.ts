/**
 * Turning a directory that holds a package into a package.
 *
 * Separate from getting the directory, and deliberately so. What language a
 * package is written in is the author's business, and `github:org/repo` is as
 * plausibly Python as JavaScript, so letting the scheme pick the loader would put
 * the author's implementation language in the organiser's config and make it
 * something they had to edit if the package were ever rewritten.
 *
 * A loader therefore claims a directory rather than a specifier, and it hands back
 * a package whose hooks are ordinary JS functions. Whatever it had to do to get
 * there is its own affair, which is the property that lets a loader that talks to
 * another process arrive later without anything else changing.
 */
import { FileSystem, Path } from "@effect/platform";
import { Data, Effect as E } from "effect";
import type { PackageRef } from "./uri";

/** What a loader hands back. Hooks are native functions, whatever the runtime. */
export type Loaded = {
  /** The package's default export, as the chain consumes it. */
  module: unknown;
  /** Released when the registry shuts down. Absent when there is nothing to release. */
  stop?: () => Promise<void>;
};

export class LoadError extends Data.TaggedError("LoadError")<{
  uri: string;
  message: string;
  cause?: unknown;
}> {}

export type Loader = {
  id: string;
  /** Can this loader load what is in this directory? */
  claim: (
    dir: string,
    manifest: Manifest | undefined,
  ) => E.Effect<boolean, never, FileSystem.FileSystem | Path.Path>;
  start: (
    dir: string,
    ref: PackageRef,
    manifest: Manifest | undefined,
  ) => E.Effect<Loaded, LoadError, FileSystem.FileSystem | Path.Path>;
};

/**
 * What a package says about itself, where it says anything.
 *
 * Optional on purpose: a package with a `package.json` and no manifest is
 * JavaScript, which is every package that exists today and which is why none of
 * them need editing.
 */
export type Manifest = {
  /** `js` is the only runtime with a loader. Anything else is refused by name. */
  runtime?: string;
  /** What to import, where the package's own metadata does not already say. */
  entry?: string;
};

export const MANIFEST_FILE = "open-competition-kit.json";

export const readManifest = (dir: string) =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = path.join(dir, MANIFEST_FILE);
    if (!(yield* fs.exists(file).pipe(E.orElseSucceed(() => false)))) {
      return undefined;
    }
    // `E.try` rather than `E.map`: a `JSON.parse` that throws inside a `map` is a
    // defect and walks straight past `orElseSucceed`, so a manifest with a stray
    // comma in it would take the whole service down instead of being ignored.
    return yield* fs.readFileString(file).pipe(
      E.flatMap((text) => E.try(() => JSON.parse(text) as Manifest)),
      E.orElseSucceed(() => undefined),
    );
  });

/**
 * The one loader that exists.
 *
 * Claims anything that is not explicitly some other runtime, which keeps a
 * package with no manifest working and makes `runtime: "js"` a statement rather
 * than a requirement.
 */
export const jsLoader: Loader = {
  id: "js",
  claim: (_dir, manifest) =>
    E.succeed(manifest?.runtime === undefined || manifest.runtime === "js"),
  start: (dir, ref, manifest) =>
    E.gen(function* () {
      const path = yield* Path.Path;
      const target = manifest?.entry ? path.join(dir, manifest.entry) : dir;
      return yield* E.tryPromise({
        try: async () => ({ module: (await import(target))?.default }) as Loaded,
        catch: (cause) =>
          new LoadError({
            uri: ref.uri,
            message: `Importing it from ${target} failed.`,
            cause,
          }),
      });
    }),
};

/**
 * Every runtime that is not JavaScript, refused by name.
 *
 * Not a placeholder for its own sake. It is what proves the manifest, the claim
 * sweep and the selection path work for something that is not JS, and it turns a
 * Python package into an error that names the package and the runtime rather than
 * an import failure that names a file with no `package.json`.
 *
 * Refusing at load rather than loading and throwing per hook is the same choice
 * the rest of the config makes: an organiser finds out when the service starts,
 * not when the first competitor submits.
 */
export const unsupportedRuntimeLoader: Loader = {
  id: "unsupported-runtime",
  // A declared runtime that is not one somebody implemented. `js` is excluded
  // here rather than by ordering, so declaring it explicitly and leaving it out
  // reach the same loader.
  claim: (_dir, manifest) =>
    E.succeed(manifest?.runtime !== undefined && manifest.runtime !== "js"),
  start: (_dir, ref, manifest) =>
    E.fail(
      new LoadError({
        uri: ref.uri,
        message:
          `It declares \`runtime: "${manifest?.runtime}"\`, and only \`js\` has a ` +
          `loader so far. Packages in other languages need the host and guest to ` +
          `agree on a wire protocol, which is not built yet.`,
      }),
    ),
};

/** Ordered, and the first to claim wins. JS is last so a declared runtime is read first. */
export const LOADERS: readonly Loader[] = [unsupportedRuntimeLoader, jsLoader];

export const loaderFor = (dir: string, ref: PackageRef, loaders: readonly Loader[] = LOADERS) =>
  E.gen(function* () {
    const manifest = yield* readManifest(dir);
    for (const loader of loaders) {
      if (yield* loader.claim(dir, manifest)) {
        return { loader, manifest };
      }
    }
    return yield* E.fail(
      new LoadError({
        uri: ref.uri,
        message: `Nothing in ${dir} looks like a package any loader can read.`,
      }),
    );
  });
