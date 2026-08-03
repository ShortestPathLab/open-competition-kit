import { Data, Effect as E, Schema as S } from "effect";
import { isFunction, mergeWith } from "lodash-es";
import type { Meta, Shape, Value } from "../common/shape";
import {
  OpenCompetitionKitConfig,
  type Form,
  type Leaderboard,
} from "../config";
import { access, type Accessor } from "../config/access";
import type { ConfigExtensions } from "../config/extension";
import { createPackageResolver } from "../resolve";
import type { FileBody, FileMeta } from "../file";
import type {
  SerialisableObject,
  SerialisableValue,
} from "../serialisable";
import type {
  GateReport,
  GateRequest,
  GateStatusRequest,
  Refusal,
} from "../gate";
import type {
  SurfaceItem,
  SurfaceRequest,
  SurfaceViewProps,
} from "../surface";
import { componentSource, type Source } from "./component";
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
     * The largest file this backend will take, in bytes, or undefined for no
     * ceiling.
     *
     * A backend answers from its own settings, because the number is one of
     * them: a filesystem with a quota and a bucket with a billing limit do not
     * have the same answer, and neither of them is core's to know. Core asks
     * when it seals an upload, and a UI asks so it can turn a file away in the
     * browser rather than after it has been sent.
     */
    limit: hook<void, number | undefined>(),
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
    /**
     * Make an image exist, from a recipe the organiser wrote.
     *
     * A sandbox does not build a *submission*, and that has not changed: the
     * inputs here come from the config and from nowhere else. Job context and
     * submitted bytes never reach this hook, which is what keeps a participant
     * from choosing the image their own code is judged in.
     *
     * What has changed is who has to run `docker build` beforehand. An organiser
     * whose evaluation image is a Dockerfile next to their config had to build it
     * out of band and keep the tag in step by hand, and a stale tag fails as a
     * bad score rather than as a bad deployment.
     *
     * A build has network access by definition, since a recipe that installs
     * anything needs it. The `network: false` ceiling governs runs and cannot
     * govern this, so the protection here is the provenance of the inputs rather
     * than confinement.
     *
     * Implementations should be idempotent and cheap on the second call: the
     * caller is expected to ask on every startup, and may ask again per job.
     */
    build: hook<
      {
        /** The recipe itself, not a path. Inlined from the config. */
        dockerfile: string;
        /**
         * A directory the recipe may copy from, on the host running the build.
         *
         * Absent means an empty context, which is the common case: a recipe that
         * installs packages and clones a repository copies nothing in.
         */
        context?: string;
        /** Build arguments, e.g. a pinned ref for whatever gets cloned. */
        args?: Readonly<Record<string, string>>;
        /**
         * What to call the result.
         *
         * Advisory. An implementation is free to derive its own tag, and the one
         * it returns is the one to run.
         */
        tag?: string;
      },
      {
        /** The image to pass to `run`. */
        image: string;
        /** False when the image already existed and nothing was built. */
        built: boolean;
        /** The build log, for an organiser working out why a recipe failed. */
        log: string;
      }
    >(),
    run: hook<
      {
        /**
         * The image, already built.
         *
         * Either one the host already has, or whatever `build` handed back.
         * Nothing is built here: by the time a submission is in the room, the
         * image it runs in is settled.
         */
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
    /**
     * Whether this user may submit to this track right now, asked before any
     * submission exists.
     *
     * Chained like every other hook, and threaded the way `form.loader` threads
     * its `def`: `refusals` holds what the packages further out have already
     * decided, and an implementation adds its own before passing the combined
     * list inward.
     *
     *     gate: async ({ user, track, refusals }, next) => {
     *       const all = [...refusals, ...mine]
     *       return (await next?.({ user, track, refusals: all })) ?? all
     *     }
     *
     * The `?? all` tail is what terminates the chain, since `noop` sits innermost
     * in most configurations and answers with nothing. Returning your own list
     * rather than what `next` gave back discards every refusal beneath you, which
     * is the one mistake here that reads as correct.
     *
     * A query, not an action: the submission form asks this before it renders, so
     * a competitor reads why they cannot submit instead of finding out by trying.
     * The same call decides the real thing inside `submissions.submit`.
     */
    gate: hook<GateRequest, readonly Refusal[]>(),
    /**
     * What every gate has to say about a track, refusing or not.
     *
     * Chained and additive exactly like `gate`, and threaded the same way:
     *
     *     status: async ({ track, user, reports }, next) => {
     *       const all = [...reports, ...mine]
     *       return (await next?.({ track, user, reports: all })) ?? all
     *     }
     *
     * Separate from `gate` on purpose, although a package will usually answer
     * both from the same internals. `gate` decides whether a submission is
     * accepted and has to fail closed; this one is advisory, is asked while a
     * list of tracks renders, and is cached. Deriving enforcement from display
     * would tie the strictness of one to the freshness of the other.
     *
     * `user` is absent when nobody is signed in, and an implementation should
     * answer with whatever is true regardless of who is asking rather than
     * refusing to answer at all.
     */
    status: hook<GateStatusRequest, readonly GateReport[]>(),
  }),
  runner: S.Struct({
    ui: S.Unknown,
    /**
     * Work a runner needs doing once, before any job exists.
     *
     * Called per competition when a runner service starts, and it is the only
     * hook with no job to point at. Building an evaluation image is the reason
     * it exists: doing that lazily means the first submission of the day waits
     * several minutes for `apt-get`, and a broken recipe is discovered as
     * somebody's failed job rather than as a service that would not start.
     *
     * Expected to be idempotent, since a service restarts and every restart asks
     * again. An implementation that has nothing to prepare should not implement
     * this at all.
     *
     * Told which competition it is preparing, because the `with:` list it was
     * resolved through is that competition's and the answer usually differs per
     * competition. Without it an implementation would have to prepare all of
     * them every time it was asked about one.
     */
    prepare: hook<{ competition: string }, void>(),
    run: hook<{ job: string }, { status: string }>(),
    setup: hook<{ job: string }, { status: string }>(),
    teardown: hook<{ job: string }, { status: string }>(),
  }),
  /**
   * What a package has to say inside the product.
   *
   * The counterpart to `submissions.gate`: that one refuses and explains why,
   * this one tells a competitor something useful without standing in their way.
   * An integration that creates a repository during enrolment has no other way
   * to mention it, and the pages it would appear on cannot be expected to know
   * what a repository is.
   */
  surface: S.Struct({
    /**
     * Every contribution to one region, for one reader, about one subject.
     *
     * Chained and additive, threaded exactly like the gate chain:
     *
     *     content: async (request, next) => {
     *       const items = [...request.items, ...mine]
     *       return (await next?.({ ...request, items })) ?? items
     *     }
     *
     * Returning your own list rather than what `next` gave back throws away
     * every contribution beneath you, which is the one mistake here that reads
     * as correct. `surfaces()` in the SDK writes this for you.
     *
     * Called while a page renders, so an implementation has to be cheap. The
     * host caches per region, subject and reader, and a package that needs a
     * remote lookup should memoise it rather than make the panel wait.
     */
    content: hook<SurfaceRequest, readonly SurfaceItem[]>(),
    /**
     * The renderer for one `kind: "component"` item.
     *
     * A chained lookup rather than a `componentSource`, because those do not
     * compose: the merge hands the later package's function the earlier one as
     * an argument it ignores, so the last package listed would quietly take the
     * whole region. Here each package answers for its own view ids and passes
     * anything else inward. Asking per id also keeps the wire honest, since only
     * the bundle a page actually renders crosses it.
     */
    view: hook<{ view: string }, Source<SurfaceViewProps> | undefined>(),
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
  /**
   * Config fields this package owns, by the kind of node they sit on.
   *
   * Read straight off the module rather than through the decode below, which
   * drops keys `Hooks` does not declare, and around the hook merge, which
   * composes functions and would deep-merge two schemas into neither of them.
   */
  config?: ConfigExtensions;
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
