import { Data, Effect as E, Schema as S } from "effect";
import { isFunction, mergeWith } from "es-toolkit";
import type { Meta, Shape, Value } from "../common/shape";
import {
  OpenCompetitionKitConfig,
  type Form,
  type Leaderboard,
} from "../config";
import { access, type Accessor } from "../config/access";
import type { ConfigExtensions } from "../config/extension";
import { createPackageResolver } from "../resolve";
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
import { files } from "./files";
import { hook } from "./hook";
import { machine } from "./machine";

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
  files,
  machine,
  enrolments: S.Struct({
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
     * submission exists. Chained and additive: `refusals` holds what the packages
     * further out decided, and an implementation adds its own before passing the
     * combined list inward.
     *
     *     gate: async ({ user, track, refusals }, next) => {
     *       const all = [...refusals, ...mine]
     *       return (await next?.({ user, track, refusals: all })) ?? all
     *     }
     *
     * The `?? all` tail terminates the chain, since `noop` sits innermost in most
     * configurations and answers with nothing. Returning your own list rather than
     * what `next` gave back discards every refusal beneath you, which is the one
     * mistake here that reads as correct.
     *
     * A query, not an action: the submission form asks before it renders, so a
     * competitor reads why they cannot submit instead of finding out by trying.
     */
    gate: hook<GateRequest, readonly Refusal[]>(),
    /**
     * What every gate has to say about a track, refusing or not. Chained and
     * additive exactly like `gate`:
     *
     *     status: async ({ track, user, reports }, next) => {
     *       const all = [...reports, ...mine]
     *       return (await next?.({ track, user, reports: all })) ?? all
     *     }
     *
     * Separate from `gate` on purpose. `gate` decides whether a submission is
     * accepted and has to fail closed; this one is advisory, is asked while a list
     * of tracks renders, and is cached. Deriving enforcement from display would tie
     * the strictness of one to the freshness of the other.
     *
     * `user` is absent when nobody is signed in, and an implementation should
     * answer with whatever is true regardless of who is asking.
     */
    status: hook<GateStatusRequest, readonly GateReport[]>(),
  }),
  runner: S.Struct({
    ui: S.Unknown,
    /**
     * Work a runner needs doing once, before any job exists. Called per competition
     * when a runner service starts, and the only hook with no job to point at.
     * Building an evaluation image is why it exists: doing that lazily means the
     * first submission of the day waits several minutes for `apt-get`, and a broken
     * recipe surfaces as somebody's failed job rather than a service that would not
     * start.
     *
     * Expected to be idempotent, since every restart asks again. Told which
     * competition it is preparing, because the `with:` list it was resolved through
     * is that competition's and the answer usually differs per competition.
     */
    prepare: hook<{ competition: string }, void>(),
    run: hook<{ job: string }, { status: string }>(),
    setup: hook<{ job: string }, { status: string }>(),
    teardown: hook<{ job: string }, { status: string }>(),
  }),
  /**
   * What a package has to say inside the product. The counterpart to
   * `submissions.gate`: that one refuses and explains why, this one tells a
   * competitor something useful without standing in their way.
   */
  surface: S.Struct({
    /**
     * Every contribution to one region, for one reader, about one subject. Chained
     * and additive, threaded exactly like the gate chain:
     *
     *     content: async (request, next) => {
     *       const items = [...request.items, ...mine]
     *       return (await next?.({ ...request, items })) ?? items
     *     }
     *
     * `surfaces()` in the SDK writes this for you. Called while a page renders, so
     * an implementation has to be cheap; a package needing a remote lookup should
     * memoise it rather than make the panel wait.
     */
    content: hook<SurfaceRequest, readonly SurfaceItem[]>(),
    /**
     * The renderer for one `kind: "component"` item. A chained lookup rather than a
     * `componentSource`, because those do not compose: the merge hands the later
     * package's function the earlier one as an argument it ignores, so the last
     * package listed would quietly take the whole region. Here each package answers
     * for its own view ids and passes anything else inward, which also keeps the
     * wire honest since only the bundle a page renders crosses it.
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
   * Config fields this package owns, by the kind of node they sit on. Read straight
   * off the module rather than through the decode below, which drops keys `Hooks`
   * does not declare, and around the hook merge, which composes functions and would
   * deep-merge two schemas into neither of them.
   */
  config?: ConfigExtensions;
} & DeepPartial<Hooks>;

/** Dot-notation keys for a nested object. Arrays and functions are leaves. */
type DotNotationKeys<T, Prev extends string = ""> = {
  [K in keyof T & string]: T[K] extends object ?
    `${Prev}${Prev extends "" ? "" : "."}${K}.${DotNotationKeys<T[K]>}`
  : `${Prev}${Prev extends "" ? "" : "."}${K}`;
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
