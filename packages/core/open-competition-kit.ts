import { Path } from "@effect/platform";
import { Config, Data as D, Effect as E, Either, Match as M } from "effect";
import { isFunction, mergeWith } from "es-toolkit";
import { isNil, isUndefined, noop } from "lodash-es";
import type { OpenCompetitionKitApi } from "./api";
import { OpenCompetitionKitCollections } from "./collections";
import { OpenCompetitionKitConfig } from "./config";
import { access, type Accessor } from "./config/access";
import { Hooks, OpenCompetitionKitHooks } from "./hook";
import { type schemas, type WithHooks } from "./hook/db";
import type { Namespace } from "./namespace";
import type { SerialisableObject, SerialisablePrimitive } from "./serialisable";
import { flow } from "./utils/flow";

export class CollectionOwnerError extends D.TaggedError(
  "CollectionOwnerError",
) {}

export class MissingContextError extends D.TaggedError("MissingContextError") {}
export class MissingNamespaceError extends D.TaggedError(
  "MissingNamespaceError",
) {}

export function withCollectionUtilities<
  TCreate,
  TUpdate extends { id: string },
  TFull extends { id: string },
  U1,
  E1,
  E2,
  E3,
  C1,
  C2,
  C3,
  U2 = U1,
>(
  table: WithHooks<TCreate, TUpdate, TFull, E1, C1>,
  owner: (item: TFull) => E.Effect<U1, E2, C3>,
  of: (owner: U2) => E.Effect<Readonly<TFull[]>, E3, C2>,
) {
  return {
    ...table,
    on: noop,
    of,
    owner,
    find: (...a: Parameters<typeof table.list>) =>
      table.list(...a).pipe(E.andThen((e) => e[0])),
    upsert: (a: TUpdate & TCreate) =>
      E.gen(function* () {
        const prev = yield* E.either(table.get(a.id));
        if (Either.isRight(prev)) {
          yield* table.update(a);
          return { created: false };
        } else {
          yield* table.create(a);
          return { created: true };
        }
      }),
  };
}

export function withMergeConfig<
  TCreate,
  TUpdate extends { id: string },
  TFull extends { id: string },
  TConfig,
  E1,
  C1,
  E2,
  C2,
>(
  table: WithHooks<TCreate, TUpdate, TFull, E1, C1>,
  getConfig: (id: string) => E.Effect<TConfig, E2, C2>,
) {
  return {
    ...table,
    list: (...a: Parameters<typeof table.list>) =>
      E.gen(function* () {
        const prev = yield* table.list(...a);
        const next = prev.map((b1) =>
          E.gen(function* () {
            return { ...b1, ...(yield* getConfig(b1.id)) };
          }),
        );
        return yield* E.all(next);
      }),
    get: (...a: Parameters<typeof table.get>) =>
      E.gen(function* () {
        const prev = yield* table.get(...a);
        const c = yield* getConfig(prev.id);
        return { ...prev, ...c };
      }),
    create: (...a: Parameters<typeof table.create>) =>
      E.gen(function* () {
        const prev = yield* table.create(...a);
        const c = yield* getConfig(prev.id);
        return { ...prev, ...c };
      }),
  };
}

export class OpenCompetitionKit extends E.Service<OpenCompetitionKit>()(
  "open-competition-kit/OpenCompetitionKit",
  {
    effect: E.gen(function* () {
      const path = yield* Path.Path;
      const configService = yield* OpenCompetitionKitConfig;
      const config = yield* configService.config;
      const hooksService = yield* OpenCompetitionKitHooks;

      const hooks = {
        do: <U>(
          call: (h: Hooks) => Promise<U>,
          ...w: Parameters<typeof hooksService.get>
        ) =>
          E.provideService(
            hooksService.get(...w).pipe(E.andThen(call)),
            Path.Path,
            path,
          ),
      };

      const db = yield* OpenCompetitionKitCollections;
      const instance = yield* db();
      type OptionalNamespace<T, U extends Record<string, any>> =
        T extends undefined ? { namespace: Namespace } & U
        : { namespace?: never } & U;
      const namespacedContext = <T extends Namespace | undefined = undefined>(
        ns?: T,
      ) => ({
        set: ({
          namespace = ns,
          owner,
          reference,
          value,
        }: OptionalNamespace<
          T,
          { owner: string; reference: string; value: SerialisableObject }
        >) =>
          E.gen(function* () {
            if (!namespace) return yield* E.fail(new MissingNamespaceError());
            const existing = yield* context.list({
              namespace,
              owner,
              reference,
            });
            // Edge case there could be many contexts with the same reference,
            // though this is unusual.
            if (!existing.length) {
              const created = yield* instance.context.create({
                namespace,
                owner,
                reference,
                value,
              });
              return { context: [created.id] };
            }

            yield* E.forEach(existing, (entry) =>
              instance.context.update({ id: entry.id, value }),
            );

            return { context: existing.map((entry) => entry.id) };
          }),
        require: ({
          namespace = ns,
          owner,
          reference,
        }: OptionalNamespace<T, { owner: string; reference: string }>) =>
          E.gen(function* () {
            if (!namespace) return yield* E.fail(new MissingNamespaceError());
            const existing = yield* context.find({
              owner,
              namespace,
              reference,
            });
            if (!existing || isNil(existing.value)) {
              return yield* E.fail(new MissingContextError());
            }
            return existing.value as NonNullable<SerialisablePrimitive>;
          }),
        get: ({
          namespace = ns,
          owner,
          reference,
        }: OptionalNamespace<T, { owner: string; reference: string }>) =>
          E.gen(function* () {
            if (!namespace) return yield* E.fail(new MissingNamespaceError());
            const existing = yield* context.find({
              owner,
              namespace,
              reference,
            });
            return existing?.value as SerialisablePrimitive | undefined;
          }),
      });

      // ─── Competition ─────────────────────────────────────

      const competitions = flow(
        instance.competitions,
        (c) => withMergeConfig(c, (id) => access({ competitions: id }, config)),
        (c) =>
          withCollectionUtilities(
            c,
            () => E.fail(new CollectionOwnerError()),
            () => c.list({}),
          ),
      );

      // ─── User ────────────────────────────────────────────

      const users = withCollectionUtilities(
        instance.users,
        () => E.fail(new CollectionOwnerError()),
        () => instance.users.list({}),
      );

      // ─── Track ───────────────────────────────────────────

      const tracks = flow(
        instance.tracks,
        (c) =>
          withMergeConfig(c, (id) =>
            access({ competitions: { tracks: id } }, config),
          ),
        (c) =>
          withCollectionUtilities(
            c,
            (track) => competitions.get(track.competition),
            (competition) => c.list({ competition: competition.id }),
          ),
      );
      // ─── Form ────────────────────────────────────────────

      const forms = {
        get: (id: string) =>
          access({ competitions: { tracks: id } }, config).pipe(
            E.andThen((c) => c.form),
          ),
        load: (track: string, user: string) =>
          E.gen(function* () {
            const def = (yield* access(
              { competitions: { tracks: track } },
              config,
            )).form;
            const loaded = yield* hooks.do(
              (h) => h.form.loader({ def, user }),
              { competitions: { tracks: track } },
            );
            return loaded?.def ?? def;
          }),
      };
      // ─── Leaderboard ─────────────────────────────────────

      const leaderboards = {
        get: (id: string) =>
          access({ competitions: { leaderboards: id } }, config),
        load: (leaderboard: string) =>
          E.gen(function* () {
            const def = yield* access(
              { competitions: { leaderboards: leaderboard } },
              config,
            );
            const loaded = yield* hooks.do(
              (h) => h.leaderboard.loader({ def }),
              { competitions: { leaderboards: leaderboard } },
            );
            return loaded?.def ?? { ...def, items: [] };
          }),
      };
      // ─── Enrolment ───────────────────────────────────────────────────────────────

      const enrolments = {
        ...withCollectionUtilities(
          instance.enrolments,
          (enrolment) => tracks.get(enrolment.track),
          (owner: typeof schemas.user.Type | typeof schemas.track.Type) =>
            M.value(owner).pipe(
              M.tag("open-competition-kit/db/user", (user) =>
                instance.enrolments.list({ user: user.id }),
              ),
              M.tag("open-competition-kit/db/track", (track) =>
                instance.enrolments.list({ track: track.id }),
              ),
              M.exhaustive,
            ),
        ),
        isEnrolled: (user: string, track: string) =>
          E.gen(function* () {
            const trackDetails = yield* tracks.get(track);
            const es = yield* enrolments.list({
              track,
              competition: trackDetails.competition,
              user,
            });
            return !!es.length;
          }),
        enrol: (user: string, track: string) =>
          hooks.do((h) => h.enrolments.enrol({ user, track }), {
            competitions: { tracks: track },
          }),
      };
      // ─── Submission ──────────────────────────────────────

      const submissions = {
        ...withCollectionUtilities(
          instance.submissions,
          (submission) => tracks.get(submission.track),
          (track) => instance.submissions.list({ track: track.id }),
        ),
        submit: (user: string, body: string, track: string) =>
          hooks.do((h) => h.submissions.submit({ user, track, body }), {
            competitions: { tracks: track },
          }),
      };
      // ─── Job ─────────────────────────────────────────────────────────────────────

      const jobs = {
        ...withCollectionUtilities(
          instance.jobs,
          (job) => submissions.get(job.submission),
          (submission) => instance.jobs.list({ submission: submission.id }),
        ),
        context: namespacedContext("open-competition-kit/namespace/job"),
        createFromSubmission: (submission: string) =>
          E.gen(function* () {
            const created = yield* instance.jobs.create({
              submission,
              status: "pending",
            });
            return { jobs: [created.id] };
          }),
        run: (job: string) =>
          E.gen(function* () {
            const c = yield* jobs
              .get(job)
              .pipe(
                E.andThen(jobs.owner),
                E.andThen(submissions.owner),
                E.andThen(tracks.owner),
              );
            yield* hooks.do((h) => h.runner.setup({ job }), {
              competitions: c.id,
            });
            yield* hooks.do((h) => h.runner.run({ job }), {
              competitions: c.id,
            });
            yield* hooks.do((h) => h.runner.teardown({ job }), {
              competitions: c.id,
            });
          }),
      };

      // ─── Context ─────────────────────────────────────────────────────────────────

      const context = {
        ...namespacedContext(),
        ...withCollectionUtilities(
          instance.context,
          (ctx) =>
            M.value(ctx).pipe(
              M.when({ namespace: "open-competition-kit/namespace/job" }, (c) =>
                jobs.get(c.owner),
              ),
              M.when(
                { namespace: "open-competition-kit/namespace/user" },
                (c) => users.get(c.owner),
              ),
              M.when(
                { namespace: "open-competition-kit/namespace/user/secret" },
                (c) => users.get(c.owner),
              ),
              M.when(
                { namespace: "open-competition-kit/namespace/job/output" },
                (c) => jobs.get(c.owner),
              ),
              M.exhaustive,
            ),
          (owner: typeof schemas.user.Type | typeof schemas.job.Type) =>
            M.value(owner).pipe(
              M.tag("open-competition-kit/db/job", () =>
                instance.context.list({
                  owner: owner.id,
                  namespace: "open-competition-kit/namespace/job",
                }),
              ),
              M.tag("open-competition-kit/db/user", () =>
                instance.context.list({
                  owner: owner.id,
                  namespace: "open-competition-kit/namespace/user",
                }),
              ),
              M.exhaustive,
            ),
        ),
      };

      // ─── Output ──────────────────────────────────────────

      const outputs = namespacedContext(
        "open-competition-kit/namespace/job/output",
      );

      // ─── Secret ──────────────────────────────────────────

      const secrets = {
        global: {
          get: (s: string) =>
            E.gen(function* () {
              return config.secrets && s in config.secrets ?
                  config.secrets[s]
                : yield* Config.string(s);
            }),
          require: (s: string) =>
            E.gen(function* () {
              const c = yield* secrets.global.get(s);
              if (isUndefined(c))
                return yield* E.fail(new MissingContextError());
              return c;
            }),
        },
        user: namespacedContext("open-competition-kit/namespace/user/secret"),
      };

      // ─────────────────────────────────────────────────────

      return {
        secrets,
        config: {
          get: () => config,
          access: <T extends Accessor>(accessor: T) => access(accessor, config),
        },
        competitions,
        tracks,
        forms,
        leaderboards,
        users,
        enrolments,
        submissions,
        jobs,
        context,
        outputs,
        hooks,
      } satisfies OpenCompetitionKitApi;
    }),
  },
) {}
