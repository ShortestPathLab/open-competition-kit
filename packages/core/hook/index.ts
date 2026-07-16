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
import type { FileBody, FileMeta } from "../file";
import type {
  SerialisableObject,
  SerialisableValue,
} from "../serialisable";
import { componentSource } from "./component";
import { db } from "./db";
import { hook } from "./hook";

type LeaderboardUiDef = Meta & {
  name?: string;
  shape: readonly Shape[];
  items: readonly Record<string, Value>[];
  // Serialisable, not `unknown`: this def crosses the server/client boundary, so
  // the type has to prove it can survive the trip.
  options?: SerialisableObject;
};

export const Hooks = S.Struct({
  db,
  /**
   * Large file storage.
   *
   * Like `db`, this is an *infrastructure* implementation point: it moves bytes,
   * so it deals in streams and cannot cross a language boundary. The extension
   * points packages actually reach for — forms, runners, leaderboards — stay
   * serialisable.
   */
  files: S.Struct({
    /** Store bytes. Returns what the caller should persist in the database. */
    write: hook<
      { key: string; body: FileBody; contentType?: string },
      FileMeta
    >(),
    /** Stream the bytes back out. */
    read: hook<{ key: string }, ReadableStream<Uint8Array>>(),
    /** Size, existence, checksum — without fetching the body. */
    peek: hook<{ key: string }, FileMeta | undefined>(),
    delete: hook<{ key: string }, void>(),
    /**
     * A URL the browser can use directly, so a large upload or download never
     * passes through the app server. Backends that cannot presign return
     * undefined, and the caller proxies instead — every backend stays usable,
     * good ones get to be fast.
     */
    link: hook<
      { key: string; mode: "read" | "write"; expiresIn?: number },
      string | undefined
    >(),
  }),
  /**
   * Running untrusted code.
   *
   * Infrastructure, like `db` and `files`: it needs a real machine, so it cannot
   * cross a language boundary. A runner describes *what* to run and how tightly
   * to confine it; the package decides how — Docker today, something else later.
   *
   * The defaults deny: no network, a memory cap, a process cap, a read-only root
   * and a wall-clock limit. A caller must opt back out, because the code being
   * run was written by someone the organiser has never met.
   */
  sandbox: S.Struct({
    run: hook<
      {
        /** The image, already built. Sandboxes do not build. */
        image: string;
        command: readonly string[];
        /**
         * Files to place inside before it starts, keyed by absolute path. This
         * is how a submission gets in: the image owns the harness, and these
         * overlay only what the submission is allowed to change.
         */
        files?: Readonly<Record<string, Uint8Array | string>>;
        env?: Readonly<Record<string, string>>;
        /** Where `command` runs. Defaults to the image's WORKDIR. */
        cwd?: string;
        /** Wall-clock limit. The sandbox is killed, not asked, when it passes. */
        timeoutMs?: number;
        limits?: {
          memoryMb?: number;
          cpus?: number;
          /** Process cap. Without one, `:(){ :|:& };:` takes the host down. */
          pids?: number;
          /** Off unless asked for. */
          network?: boolean;
          /** Writable root. Off unless asked for. */
          writable?: boolean;
        };
      },
      {
        stdout: string;
        stderr: string;
        code: number;
        /** True when the wall-clock limit killed it, which `code` alone cannot tell you. */
        timedOut: boolean;
        elapsedMs: number;
      }
    >(),
  }),
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
      // Serialisable, not scalar: a file field's value is a `FileRef` object, and
      // the submission body is JSON regardless.
      onSubmit?: (values: Record<string, SerialisableValue>) => Promise<void>;
    }>(),
    submit: S.Unknown,
  }),
  leaderboard: S.Struct({
    loader: hook<
      { def: Leaderboard; competition: string },
      { def: LeaderboardUiDef }
    >(),
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

export type Package = {
  name?: string;
  description?: string;
  version?: string;
} & DeepPartial<Hooks>;

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
              catch: (e) => {
                // `E.logError` builds an effect; it was never yielded, so a
                // package that failed to import said nothing at all and surfaced
                // as a bare ImportError with no cause. Log it for real.
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
