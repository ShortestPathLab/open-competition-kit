import { Path } from "@effect/platform";
import { Data, Effect as E, Match as M, pipe, Schema as S } from "effect";
import { isFunction, mergeWith } from "lodash-es";
import type { Meta, Shape, Value } from "../common/shape";
import {
  OpenCompetitionKitConfig,
  type Form,
  type Leaderboard,
} from "../config";
import { access, type Accessor } from "../config/access";
import { componentSource } from "./component";
import { db } from "./db";
import { hook } from "./hook";

type LeaderboardUiDef = Meta & {
  shape: Shape[];
  items: Record<string, Value>[];
};

export const Hooks = S.Struct({
  db,
  enrolments: S.Struct({
    /**
     * The enrol handler.
     */
    enrol: hook<{ track: string; user: string }, string>(),
  }),
  user: S.Struct({}),
  track: S.Struct({ enrol: S.Unknown }),
  form: S.Struct({
    loader: hook<{ def: Form; user: string }, { def: Form }>(),
    ui: componentSource<{
      def: Form;
      onSubmit?: (values: Record<string, Value>) => Promise<void>;
    }>(),
    submit: S.Unknown,
  }),
  leaderboard: S.Struct({
    loader: hook<{ def: Leaderboard }, { def: LeaderboardUiDef }>(),
    ui: componentSource<{ def: LeaderboardUiDef }>(),
  }),
  submissions: S.Struct({
    submit: hook<
      { user: string; body: string; track: string },
      { submission: string; jobs: string[] }
    >(),
  }),
  runner: S.Struct({
    ui: S.Unknown,
    run: hook<{ job: string }, { status: string }>(),
    setup: hook<{ job: string }, { status: string }>(),
    teardown: hook<{ job: string }, { status: string }>(),
  }),
});

export type Hooks = S.Schema.Type<typeof Hooks>;

type DeepPartial<T> =
  T extends { [key: string]: unknown } ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type Package = DeepPartial<Hooks>;

// Produces dot-notation keys for a nested object T (arrays and functions are treated as leaves)
type DotNotationKeys<T, Prev extends string = ""> = {
  [K in keyof T & string]: T[K] extends object ?
    // if value is an object, recurse deeper
    `${Prev}${Prev extends "" ? "" : "."}${K}.${DotNotationKeys<T[K]>}`
  : // if value is a leaf, emit this key
    `${Prev}${Prev extends "" ? "" : "."}${K}`;
}[keyof T & string];

export type HookKey = DotNotationKeys<Hooks>;

const decode = S.decodeUnknown(Hooks);

class NotImplementedError extends Data.TaggedError("NotImplementedError") {}

class ImportError extends Data.TaggedError("ImportError")<{
  cause: unknown;
  path: string;
}> {}

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
          ),
        ),
      );
    }),
  );

export class HookError extends Data.TaggedError("HookError") {}
export class AccessorError extends Data.TaggedError("AccessorError")<{
  accessor: any;
  config: any;
}> {}

const mergeHooks = <T extends object>(acc: T, next: T): T =>
  mergeWith(acc, next, (f, g) => {
    if (isFunction(f) && isFunction(g)) {
      return (...args: unknown[]) => g(...args, f);
    }
    if (isFunction(f) || isFunction(g)) return f ?? g;
  });

export class OpenCompetitionKitHooks extends E.Service<OpenCompetitionKitHooks>()(
  "open-competition-kit/Hooks",
  {
    effect: E.gen(function* () {
      const c = yield* OpenCompetitionKitConfig;
      const config = yield* c.config;
      const resolve = createPackageResolver(c.path);
      return {
        try:
          <T extends unknown[], U>(f: (...args: T) => Promise<U>) =>
          <U1 = U>(...t: T) =>
            E.tryPromise({
              try: () => f(...t) as unknown as Promise<U1>,
              catch: (e) => e as HookError,
            }),
        get: (accessor: Accessor = true) =>
          E.gen(function* () {
            const a = (yield* access(accessor, config)) as { with: string[] };
            if (!a)
              return yield* E.fail(new AccessorError({ accessor, config }));
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

export * from "../common/shape";
export * from "./component";
export * as db from "./db";
