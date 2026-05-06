import { Path } from "@effect/platform";
import { Data, Effect as E, Match as M, pipe, Schema as S } from "effect";
import { isFunction, mergeWith } from "lodash-es";
import { OpenCompetitionKitConfig } from "../config";
import type { Extendable } from "../config/schema";
import { db } from "./db";
import { hook } from "./hook";
import { componentSource } from "./component";

export const Hooks = S.Struct({
  db,
  enrolments: S.Struct({
    /**
     * The enrol handler.
     */
    enrol: hook(
      S.Struct({
        track: S.String,
        user: S.String,
      }),
      /**
       * The ID of the created enrolment record.
       */
      S.String,
    ),
  }),
  user: S.Struct({}),
  track: S.Struct({
    enrol: S.Unknown,
  }),
  form: S.Struct({
    ui: componentSource,
    submit: S.Unknown,
  }),
  leaderboard: S.Struct({
    ui: componentSource,
  }),
  submissions: S.Struct({
    submit: hook(
      S.Struct({
        user: S.String,
        body: S.String,
        track: S.String,
      }),
      S.Struct({
        submission: S.String,
        jobs: S.Array(S.String),
      }),
    ),
  }),
  runner: S.Struct({
    ui: S.Unknown,

    run: hook(
      S.Struct({
        job: S.String,
      }),
      S.Struct({
        status: S.String,
      }),
    ),
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
  constructor(readonly params: { cause: unknown; path: string }) {
    super();
  }
}

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
              catch: (e) => new ImportError({ cause: e, path: p }),
            }),
            E.andThen(decodePartial),
          ),
        ),
      );
    }),
  );

export class HookError extends Data.TaggedError("HookError") {}
export class AccessorError extends Data.TaggedError("AccessorError") {}

const mergeHooks = <T extends object>(acc: T, next: T): T =>
  mergeWith(acc, next, (f, g) => {
    if (isFunction(f) && isFunction(g)) {
      return (...args: unknown[]) => g(...args, f);
    }
  });

export class OpenCompetitionKitHooks extends E.Service<OpenCompetitionKitHooks>()(
  "open-competition-kit/Hooks",
  {
    effect: E.gen(function* () {
      const c = yield* OpenCompetitionKitConfig;
      const config = yield* c.config;
      const resolve = createPackageResolver(yield* c.path);
      return {
        try:
          <T extends unknown[], U>(f: (...args: T) => Promise<U>) =>
          <U1 = U>(...t: T) =>
            E.tryPromise({
              try: () => f(...t) as unknown as Promise<U1>,
              catch: (e) => e as HookError,
            }),
        get: (
          accessor: (c: typeof config) => Extendable | undefined = (c) => c,
        ) =>
          E.gen(function* () {
            const a = accessor(config);
            if (!a) throw new AccessorError();
            const merged = yield* E.mergeAll(
              a.with.map(yield* resolve),
              {},
              mergeHooks,
            );
            return yield* decode(merged);
          }),
      };
    }),
  },
) {}

export * as db from "./db";
