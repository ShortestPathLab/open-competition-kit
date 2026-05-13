import { Path } from "@effect/platform";
import { Config, Data as D, Effect as E, Match as M } from "effect";
import { find, isNil, isUndefined, mapValues, noop } from "lodash-es";
import type { OpenCompetitionKitApi } from "./api";
import { OpenCompetitionKitCollections } from "./collections";
import { OpenCompetitionKitConfig } from "./config";
import { Hooks, OpenCompetitionKitHooks } from "./hook";
import { type schemas, type WithHooks } from "./hook/db";
import { flow } from "./utils/flow";
import type { Namespace } from "./namespace";
import type { SerialisablePrimitive } from "./serialisable";
import { access, type Accessor } from "./config/access";

export class CollectionOwnerError extends D.TaggedError(
  "CollectionOwnerError",
) {}

export class MissingContextError extends D.TaggedError("MissingContextError") {}
export class MissingNamespaceError extends D.TaggedError(
  "MissingNamespaceError",
) {}

export function collectionFrom<
  TCreate,
  TUpdate,
  TFull,
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
  return E.gen(function* () {
    return {
      on: noop,
      of,
      owner,
      ...table,
      find: (...a: Parameters<typeof table.list>) =>
        table.list(...a).pipe(E.andThen((e) => e[0])),
    };
  });
}

export class OpenCompetitionKit extends E.Service<OpenCompetitionKit>()(
  "open-competition-kit/OpenCompetitionKit",
  {
    effect: E.gen(function* () {
      const path = yield* Path.Path;
      const configService = yield* OpenCompetitionKitConfig;
      const config = yield* configService.config;
      const hooks = yield* OpenCompetitionKitHooks;
      const doHook = <U>(
        call: (h: Hooks) => Promise<U>,
        ...w: Parameters<typeof hooks.get>
      ) =>
        E.provideService(
          hooks.get(...w).pipe(E.andThen(call)),
          Path.Path,
          path,
        );
      const competitionConfig = (competitionId: string) =>
        find(config.competitions, { id: competitionId });
      const trackConfig = (trackId: string) =>
        flow(
          config.competitions,
          (competitions) =>
            competitions.flatMap((competition) => competition.tracks),
          (tracks) => find(tracks, { id: trackId }),
        );
      const formConfig = (trackId: string) => trackConfig(trackId)?.form;
      const leaderboardConfig = (leaderboardId: string) =>
        flow(
          config.competitions,
          (competitions) =>
            competitions.flatMap((competition) => competition.leaderboards),
          (leaderboards) => find(leaderboards, { id: leaderboardId }),
        );
      const db = yield* OpenCompetitionKitCollections;
      const instance = yield* db();
      const competitions = yield* collectionFrom(
        instance.competitions,
        () => E.fail(new CollectionOwnerError()),
        () => instance.competitions.list({}),
      );
      const competitionCollection = {
        ...competitions,
        config: { get: competitionConfig },
      };
      const users = {
        ...(yield* collectionFrom(
          instance.users,
          () => E.fail(new CollectionOwnerError()),
          () => instance.users.list({}),
        )),
      };
      const tracks = yield* collectionFrom(
        instance.tracks,
        (track) => competitions.get(track.competition),
        (competition) => instance.tracks.list({ competition: competition.id }),
      );
      const trackCollection = { ...tracks, config: { get: trackConfig } };
      const forms = {
        config: { get: formConfig },
        load: (track: string, user: string) =>
          E.gen(function* () {
            const def = access(
              { competitions: { tracks: track } },
              config,
            )?.form;
            const loaded = yield* doHook((h) => h.form.loader({ def, user }), {
              competitions: { tracks: track },
            });
            return loaded?.def ?? def;
          }),
      };
      const leaderboards = {
        config: { get: leaderboardConfig },
        load: (leaderboard: string) =>
          E.gen(function* () {
            const loaded = yield* doHook(
              (h) =>
                h.leaderboard.loader({
                  def: access(
                    { competitions: { leaderboards: leaderboard } },
                    config,
                  ),
                }),
              { competitions: { leaderboards: leaderboard } },
            );
            return loaded?.def;
          }),
      };

      const enrolments = {
        ...(yield* collectionFrom(
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
        )),
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
          doHook((h) => h.enrolments.enrol({ user, track }), {
            competitions: { tracks: track },
          }),
      };
      const submissions = {
        ...(yield* collectionFrom(
          instance.submissions,
          (submission) => tracks.get(submission.track),
          (track) => instance.submissions.list({ track: track.id }),
        )),
        submit: (user: string, body: string, track: string) =>
          doHook((h) => h.submissions.submit({ user, track, body }), {
            competitions: { tracks: track },
          }),
      };
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
          { owner: string; reference: string; value: string }
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
      const jobs = {
        ...(yield* collectionFrom(
          instance.jobs,
          (job) => submissions.get(job.submission),
          (submission) => instance.jobs.list({ submission: submission.id }),
        )),
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
            return yield* doHook((h) => h.runner.run({ job }), {
              competitions: c.id,
            });
          }),
      };

      const context = {
        ...namespacedContext(),
        ...(yield* collectionFrom(
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
        )),
      };
      const outputs = {
        ...(yield* collectionFrom(
          instance.outputs,
          (output) => jobs.get(output.job),
          (job) => instance.outputs.list({ job: job.id }),
        )),
        set: (job: string, reference: string, body: string) =>
          E.gen(function* () {
            const existing = yield* outputs.list({ job, reference });
            if (existing.length === 0) {
              const created = yield* instance.outputs.create({
                job,
                reference,
                value: body,
              });
              return { outputs: [created.id] };
            }

            yield* E.forEach(existing, (output) =>
              instance.outputs.update({
                id: output.id,
                job: output.job,
                reference: output.reference,
                value: body,
              }),
            );
            return { outputs: existing.map((output) => output.id) };
          }),
      };
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
      return {
        secrets,
        config: {
          get: () => config,
          access: <T extends Accessor>(accessor: T) => access(accessor, config),
        },
        competitions: competitionCollection,
        hooks: { do: doHook },
        tracks: trackCollection,
        forms,
        leaderboards,
        users,
        enrolments,
        submissions,
        jobs,
        context,
        outputs,
      } satisfies OpenCompetitionKitApi;
    }),
  },
) {}
