/**
 * Turning a `with:` entry into the module it names.
 *
 * Lives on its own rather than inside the hook service because two callers need
 * it and one of them is the config service: package-declared config schemas are
 * validated while the config is being loaded, which is before any hook has been
 * merged. Leaving this in `./hook` would mean config importing hooks importing
 * config.
 */
import { Path } from "@effect/platform";
import { Data, Effect as E, Match as M, pipe } from "effect";

export class NotImplementedError extends Data.TaggedError(
  "NotImplementedError",
) {}

export class ImportError extends Data.TaggedError("ImportError")<{
  cause: unknown;
  path: string;
}> {}

/**
 * Import each package once per process, memoised on the specifier.
 *
 * A failed import is logged with its cause rather than swallowed. `E.logError`
 * builds an effect, so an earlier version that never yielded it said nothing at
 * all and surfaced as a bare `ImportError` with nowhere to look.
 */
export const createPackageResolver = (root: string) =>
  E.cachedFunction((p: string) =>
    E.gen(function* () {
      const path = yield* Path.Path;
      return yield* M.value(p).pipe(
        M.when(
          (s) => s.startsWith("https://"),
          () => E.fail(new NotImplementedError()),
        ),
        M.orElse(() =>
          pipe(
            E.tryPromise({
              try: async () =>
                (await import(path.resolve(path.dirname(root), p)))?.default,
              catch: (e) => {
                console.error(
                  `[open-competition-kit] Failed to load package "${p}" ` +
                    `(resolved from ${path.dirname(root)}):`,
                  e,
                );
                return new ImportError({ cause: e, path: p });
              },
            }),
          ),
        ),
      );
    }),
  );
