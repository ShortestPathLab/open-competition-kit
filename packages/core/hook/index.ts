import { Path } from "@effect/platform";
import { OpenCompetitionKitConfig } from "core/config";
import type { Extendable } from "core/config/schema";
import { Data, Effect as E, Match as M, pipe, Schema as S } from "effect";
import { merge } from "lodash-es";
import { db } from "./db";
import { hook } from "./hook";

export const Hooks = S.Struct({
  db,
  enrolments: S.Struct({
    enrol: hook(S.Unknown, S.Unknown),
  }),
  auth: S.Struct({}),
  user: S.Struct({}),
  track: S.Struct({
    enrol: S.Unknown,
  }),
  form: S.Struct({
    ui: S.Unknown,
    submit: S.Unknown,
  }),
  runner: S.Struct({
    ui: S.Unknown,
    submit: S.Unknown,
  }),
});

export type Hooks = S.Schema.Type<typeof Hooks>;

type DeepPartial<T> = T extends { [key: string]: unknown }
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type Package = DeepPartial<Hooks>;

// Produces dot-notation keys for a nested object T (arrays and functions are treated as leaves)
type DotNotationKeys<T, Prev extends string = ""> = {
  [K in keyof T & string]: T[K] extends object
    ? // if value is an object, recurse deeper
      `${Prev}${Prev extends "" ? "" : "."}${K}.${DotNotationKeys<T[K]>}`
    : // if value is a leaf, emit this key
      `${Prev}${Prev extends "" ? "" : "."}${K}`;
}[keyof T & string];

export type HookKey = DotNotationKeys<Hooks>;

const decode = S.decodeUnknown(Hooks);
const decodePartial = S.decodeUnknown(S.partial(Hooks));

class NotImplementedError extends Data.TaggedError("NotImplementedError") {}

class ImportError extends Data.TaggedError("ImportError") {
  constructor(readonly params: { cause: unknown }) {
    super();
  }
}

export const resolve = (p: string) =>
  E.gen(function* () {
    const path = yield* Path.Path;
    return yield* M.value(p).pipe(
      // URL case
      M.when(
        (s) => s.startsWith("https://"),
        () => E.fail(new NotImplementedError()),
      ),
      // JS local file case
      M.orElse(() =>
        pipe(
          E.tryPromise({
            try: async () => (await import(path.resolve(p)))?.default,
            catch: (e) => new ImportError({ cause: e }),
          }),
          E.andThen(decodePartial),
        ),
      ),
    );
  });

export class HookError extends Data.TaggedError("HookError") {}

export class OpenCompetitionKitHooks extends E.Service<OpenCompetitionKitHooks>()(
  "open-competition-kit/Hooks",
  {
    effect: E.gen(function* () {
      const c = yield* OpenCompetitionKitConfig;
      const config = yield* c.config;
      return {
        try:
          <T extends unknown[], U>(f: (...args: T) => Promise<U>) =>
          <U1 = U>(...t: T) =>
            E.tryPromise({
              try: () => f(...t) as unknown as Promise<U1>,
              catch: (e) => e as HookError,
            }),
        get: (accessor: (c: typeof config) => Extendable = (c) => c) => {
          const { with: w } = accessor(config);
          return E.mergeAll(w.map(resolve), {}, merge).pipe(E.andThen(decode));
        },
      };
    }),
  },
) {}

export * as db from "./db";
