import { FileSystem, Path } from "@effect/platform";
import {
  Config as C,
  Data,
  Effect as E,
  Match as M,
  Option as O,
  pipe,
  Schema as S,
} from "effect";
import { load as _load, YAMLException } from "js-yaml";
import { mapValues, uniq } from "lodash-es";
import { createPackageResolver } from "../resolve";
import { describeConfig } from "./describe";
import { migrate } from "./migrate";
import { decode, Extendable } from "./schema";
import { transform } from "./transform";
import { validateConfig } from "./validate";

export * from "./schema";
export * from "./access";
export * from "./transform";
export * from "./extension";
export * from "./validate";
export * from "./walk";
export * from "./describe";
export * from "./visibility";

const load = (s: string) =>
  E.try({ try: () => _load(s), catch: (e) => e as YAMLException });

export const propagateExtendable = <T>(t: T, w: string[] = []): T => {
  const ctx = O.match(S.decodeUnknownOption(Extendable)(t), {
    onNone: () => w,
    onSome: (t) => uniq([...w, ...t.with]),
  });
  return M.value(t).pipe(
    // Array case
    M.when(M.instanceOf(Array), (t) =>
      t.map((v) => propagateExtendable(v, ctx)),
    ),
    // Object case
    M.when(M.instanceOf(Object), (t) => ({
      ...mapValues(t, (v: string) => propagateExtendable(v, ctx)),
      with: ctx,
    })),
    // Primitive case
    M.orElse(() => t),
  ) as T;
};

class FileNotResolvedError extends Data.TaggedError("FileNotResolvedError")<{
  file: string;
}> {}

const resolveRecursive = (file: string, from: string = "./") =>
  E.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    let dir = path.resolve(from);
    do {
      const full = path.resolve(dir, file);
      const directory = path.dirname(full);
      if (yield* fs.exists(full)) {
        return { cwd: directory, path: full };
      }
      dir = path.resolve(dir, "..");
    } while (dir !== "/");
    return yield* E.fail(new FileNotResolvedError({ file }));
  });

export class OpenCompetitionKitConfig extends E.Service<OpenCompetitionKitConfig>()(
  "open-competition-kit/Config",
  {
    effect: E.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const { cwd, path } = yield* pipe(
        C.string("CONFIG"),
        C.withDefault("./competition.config.yaml"),
        E.andThen(resolveRecursive),
      );
      yield* E.logInfo(`Using configuration at ${path}`);

      /**
       * The config as authored, with interpolations resolved and core's own
       * schema applied. Package-declared fields are present but unchecked.
       *
       * This is what the package resolver runs against, and it is the reason
       * there are two stages rather than one: validating package fields means
       * importing the packages, and knowing which packages to import means
       * reading `with:` off the config. Splitting here breaks that loop without
       * either half having to know about the other.
       *
       * `transform` runs before `decode`, not after. A template is a string
       * wherever it is written, so `competitions: [${{ yaml("./x.yaml") }}]` is a
       * list of strings until it resolves, and a schema applied first would
       * reject it for not being a list of competitions.
       */
      const raw = pipe(
        fs.readFileString(path),
        E.andThen(load),
        // Straight after parsing, so a block we renamed is under its current
        // name before anything else looks at it.
        E.andThen(migrate),
        E.andThen((config) => transform(cwd, config)),
        E.andThen(decode),
      );

      const resolve = createPackageResolver(path);

      const config = pipe(
        raw,
        E.andThen((config) =>
          E.gen(function* () {
            const validated = yield* validateConfig(
              config as unknown as Record<string, unknown>,
              { resolve: yield* resolve },
            );
            return validated as unknown as typeof config;
          }),
        ),
        // Last, so that no node is carrying an inherited `with` while it is
        // being checked against the fields a package says it may have.
        E.map(propagateExtendable),
      );

      /**
       * The same tree, described for a config editor rather than checked.
       *
       * Built from `raw` rather than from `config`, so the values shown are the
       * ones an organiser would find in the file. The propagated `with` on every
       * node is a derivation, and putting it in front of somebody editing their
       * own config would be showing them a setting they never wrote.
       *
       * Cached at construction, which does two things. It reads the file and
       * imports the packages once per process instead of once per page view, and
       * it discharges the platform services here, where they are in scope, so a
       * caller gets an effect it can run without holding a filesystem.
       */
      const describe = yield* E.cached(
        pipe(
          raw,
          E.andThen((config) =>
            E.gen(function* () {
              return yield* describeConfig(
                config as unknown as Record<string, unknown>,
                yield* resolve,
              );
            }),
          ),
          E.provideService(FileSystem.FileSystem, fs),
          E.provideService(Path.Path, pathService),
        ),
      );

      return { cwd, path, raw, config, describe };
    }),
  },
) {}
