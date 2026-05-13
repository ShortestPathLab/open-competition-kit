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
import { decode, Extendable } from "./schema";

export * from "./schema";
export * from "./access";

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
      const { cwd, path } = yield* pipe(
        C.string("CONFIG"),
        C.withDefault("./competition.config.yaml"),
        E.andThen(resolveRecursive),
      );
      yield* E.logInfo(`Using configuration at ${path}`);
      const raw = pipe(
        fs.readFileString(path),
        E.andThen(load),
        E.andThen(decode),
      );
      return { cwd, path, config: raw.pipe(E.map(propagateExtendable)) };
    }),
  },
) {}
