import { FileSystem } from "@effect/platform";
import {
  Config as C,
  Effect as E,
  Match as M,
  Option as O,
  pipe,
  Schema as S,
} from "effect";
import { load as _load, YAMLException } from "js-yaml";
import { mapValues, uniq } from "lodash-es";
import { decode, Extendable } from "./schema";

const load = (s: string) =>
  E.try({
    try: () => _load(s),
    catch: (e) => e as YAMLException,
  });

export const propagateExtendable = <T>(t: T, w: string[] = []): T => {
  const ctx = O.match(S.decodeUnknownOption(Extendable)(t), {
    onNone: () => w,
    onSome: (t) => uniq([...w, ...t.with]),
  });
  return M.value(t).pipe(
    // Array case
    M.when(M.instanceOf(Array), (t) =>
      t.map((v) => propagateExtendable(v, ctx))
    ),
    // Object case
    M.when(M.instanceOf(Object), (t) => ({
      ...mapValues(t, (v: string) => propagateExtendable(v, ctx)),
      with: ctx,
    })),
    // Primitive case
    M.orElse(() => t)
  ) as T;
};

export class OpenCompetitionKitConfig extends E.Service<OpenCompetitionKitConfig>()(
  "open-competition-kit/Config",
  {
    effect: E.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = pipe(
        C.string("CONFIG"),
        C.withDefault("./competition.config.yaml"),
        E.andThen(fs.readFileString),
        E.andThen(load),
        E.andThen(decode)
      );
      return {
        config: raw.pipe(E.map(propagateExtendable)),
      };
    }),
  }
) {}
