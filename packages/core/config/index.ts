import { FileSystem, Path } from "@effect/platform";
import {
  Config as C,
  Data,
  Duration,
  Effect as E,
  Match as M,
  Option as O,
  pipe,
  Schema as S,
} from "effect";
import { load as _load, YAMLException } from "js-yaml";
import { mapValues, uniq } from "es-toolkit";
import { OpenCompetitionKitPackages } from "../package/registry";
import { describeConfig } from "./describe";
import { decode, Extendable } from "./schema";
import { transform } from "./transform";
import { validateConfig } from "./validate";
import { probeWritable } from "./writable";
import { applyWith } from "./with";
import { setConfig, type ConfigEdit } from "./write";

export * from "./schema";
export * from "./with";
export * from "./access";
export * from "./transform";
export * from "./extension";
export * from "./validate";
export * from "./walk";
export * from "./describe";
export * from "./core-fields";
export * from "./write";
export * from "./writable";
export * from "./document";
export * from "./visibility";

const load = (s: string) => E.try({ try: () => _load(s), catch: (e) => e as YAMLException });

export const propagateExtendable = <T>(t: T, w: string[] = []): T => {
  const ctx = O.match(S.decodeUnknownOption(Extendable)(t), {
    onNone: () => w,
    onSome: (t) => uniq([...w, ...t.with]),
  });
  return M.value(t).pipe(
    M.when(M.instanceOf(Array), (t) => t.map((v) => propagateExtendable(v, ctx))),
    M.when(M.instanceOf(Object), (t) => ({
      ...mapValues(t as Record<string, unknown>, (v) => propagateExtendable(v, ctx)),
      with: ctx,
    })),
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
      const packages = yield* OpenCompetitionKitPackages;

      /**
       * A document's text, parsed and resolved.
       *
       * A function of the source rather than of the file, so that the same steps
       * that decide whether the config on disk loads can be asked about a
       * document that is not on disk yet. That is what `check` below is for, and
       * it is the difference between a settings page that writes a file and one
       * that writes a file the app can still start from.
       */
      const rawOf = (source: string) =>
        pipe(
          load(source),
          E.andThen((config) => transform(cwd, config)),
          E.andThen(decode),
          // After decode, so an absent `with:` is already the empty list, and before
          // anything reads one, since both `walkNodes` and `propagateExtendable`
          // derive everything they know about packages from these lists.
          E.tap((config) => applyWith(config as unknown as Record<string, unknown>, { cwd })),
          // Discharged here rather than by each consumer. `transform` reads files
          // and `applyWith` reads a `package.json` or two, and a requirement left in
          // this channel reaches the `kit` proxy in the SDK, which only unwraps an
          // effect that needs nothing.
          E.provideService(FileSystem.FileSystem, fs),
          E.provideService(Path.Path, pathService),
        );

      const raw = pipe(fs.readFileString(path), E.andThen(rawOf));

      /** The rest of boot: every package present, every field checked. */
      const check = (source: string) =>
        pipe(
          rawOf(source),
          E.tap((config) =>
            // Every package resolved once, before anybody asks what one contains.
            // `collectExtensions` forgives a package that will not load, so without
            // this a missing one that declares no config fields would surface as a
            // chain quietly short of a link, much later and somewhere else.
            packages.preflight((config as unknown as { with: string[] }).with),
          ),
          E.andThen((config) =>
            E.gen(function* () {
              const validated = yield* validateConfig(config as unknown as Record<string, unknown>, {
                resolve: packages.load,
              });
              return validated as unknown as typeof config;
            }),
          ),
          // Last, so that no node is carrying an inherited `with` while it is
          // being checked against the fields a package says it may have.
          E.map(propagateExtendable),
        );

      const config = pipe(fs.readFileString(path), E.andThen(check));

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
      const [describe, forget] = yield* E.cachedInvalidateWithTTL(
        pipe(
          raw,
          E.andThen((config) =>
            describeConfig(config as unknown as Record<string, unknown>, packages.load),
          ),
          E.provideService(FileSystem.FileSystem, fs),
          E.provideService(Path.Path, pathService),
        ),
        // Invalidated by hand rather than by a timer: the file only changes when
        // somebody changes it, and `set` below is the one thing here that does.
        Duration.infinity,
      );

      /** Whether this deployment can save a config change, and why not. */
      const writable = pipe(
        probeWritable(path),
        E.provideService(FileSystem.FileSystem, fs),
        E.provideService(Path.Path, pathService),
      );

      /**
       * Edited values, checked the way boot would check them, then saved.
       *
       * Checked against `raw` for the same reason `describe` is built from it:
       * that is the tree an organiser edits. The validated one has been through
       * `propagateExtendable`, which stamps a `with` onto every object it walks,
       * so re-checking a node there would hand each package schema a value
       * carrying a key its author never declared.
       *
       * Read fresh each time rather than reusing the config this process booted
       * from. Somebody may have edited the file since, and their lines survive a
       * save from here because the save starts from what is on disk now.
       */
      const set = (edits: readonly ConfigEdit[]) =>
        pipe(
          fs.readFileString(path),
          E.andThen((source) =>
            pipe(
              rawOf(source),
              E.andThen((parsed) =>
                setConfig({
                  config: parsed as unknown as Record<string, unknown>,
                  edits,
                  resolve: packages.load,
                  file: { path, source },
                  check,
                }),
              ),
            ),
          ),
          // The description is a cached read of this file, so a save that changed
          // it makes the cached one wrong. Dropped here rather than by the caller,
          // since a caller that forgot would leave the settings page showing the
          // values somebody had just replaced.
          E.tap((result) => (result.stored ? forget : E.void)),
          E.provideService(FileSystem.FileSystem, fs),
          E.provideService(Path.Path, pathService),
        );

      return { cwd, path, raw, config, check, describe, writable, set };
    }),
  },
) {}
