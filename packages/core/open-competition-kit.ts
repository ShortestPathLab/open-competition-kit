import { Path } from "@effect/platform";
import { Config, Data as D, Effect as E, Match as M } from "effect";
import { find, noop } from "lodash-es";
import type { OpenCompetitionKitApi } from "./api";
import { OpenCompetitionKitCollections } from "./collections";
import { OpenCompetitionKitConfig } from "./config";
import { Hooks, OpenCompetitionKitHooks } from "./hook";
import type { schemas, WithHooks } from "./hook/db";
import { flow } from "./utils/flow";

export class CollectionOwnerError extends D.TaggedError(
  "CollectionOwnerError",
) {}

export class MissingContextError extends D.TaggedError("MissingContextError") {}

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
      const db = yield* OpenCompetitionKitCollections;
      const instance = yield* db();
      const competitions = yield* collectionFrom(
        instance.competitions,
        () => E.fail(new CollectionOwnerError()),
        () => instance.competitions.list({}),
      );
      const users = {
        ...(yield* collectionFrom(
          instance.users,
          () => E.fail(new CollectionOwnerError()),
          () => instance.users.list({}),
        )),
        storeSecrets: (userId: string, secrets: Record<string, string>) =>
          E.gen(function* () {
            const user = yield* instance.users.get(userId);
            let existingSecrets: Record<string, string> = {};

            try {
              existingSecrets = JSON.parse(user.secrets || "{}");
            } catch {}

            const nextSecrets = {
              ...existingSecrets,
              ...secrets,
            };

            yield* instance.users.update({
              id: userId,
              name: user.name,
              secrets: JSON.stringify(nextSecrets),
            });

            return nextSecrets;
          }),
      };
      const tracks = yield* collectionFrom(
        instance.tracks,
        (track) => competitions.get(track.competition),
        (competition) => instance.tracks.list({ competition: competition.id }),
      );

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
          doHook(
            (h) => h.enrolments.enrol({ user, track }),
            (c) =>
              flow(
                c.competitions,
                (c) => c.flatMap((c) => c.tracks),
                (t) => find(t, { id: track }),
              ),
          ),
      };
      const submissions = {
        ...(yield* collectionFrom(
          instance.submissions,
          (submission) => tracks.get(submission.track),
          (track) => instance.submissions.list({ track: track.id }),
        )),
        submit: (user: string, body: string, track: string) =>
          doHook(
            (h) => h.submissions.submit({ user, track, body }),
            (c) =>
              flow(
                c.competitions,
                (c) => c.flatMap((c) => c.tracks),
                (t) => find(t, { id: track }),
              ),
          ),
      };
      const jobs = {
        ...(yield* collectionFrom(
          instance.jobs,
          (job) => submissions.get(job.submission),
          (submission) => instance.jobs.list({ submission: submission.id }),
        )),
        createFromSubmission: (submission: string) =>
          E.gen(function* () {
            const created = yield* instance.jobs.create({
              submission,
              status: "pending",
            });
            return {
              jobs: [created.id],
            };
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
            return yield* doHook(
              (h) => h.runner.run({ job }),
              (a) => find(a.competitions, { id: c.id }),
            );
          }),
      };
      const context = {
        ...(yield* collectionFrom(
          instance.context,
          (context) => jobs.get(context.job),
          (job) => instance.context.list({ job: job.id }),
        )),
        set: (job: string, reference: string, body: string) =>
          E.gen(function* () {
            const existing = yield* context.list({ job, reference });
            if (existing.length === 0) {
              const created = yield* instance.context.create({
                job,
                reference,
                value: body,
              });
              return {
                context: [created.id],
              };
            }

            yield* E.forEach(existing, (entry) =>
              instance.context.update({
                id: entry.id,
                job: entry.job,
                reference: entry.reference,
                value: body,
              }),
            );
            return {
              context: existing.map((entry) => entry.id),
            };
          }),
        require: <T>(job: string, reference: string) =>
          E.gen(function* () {
            const existing = yield* context.list({ job, reference });
            const match = existing[0];
            if (!match) {
              return yield* E.fail(new MissingContextError());
            }
            return match.value as unknown as T;
          }),
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
              return {
                outputs: [created.id],
              };
            }

            yield* E.forEach(existing, (output) =>
              instance.outputs.update({
                id: output.id,
                job: output.job,
                reference: output.reference,
                value: body,
              }),
            );
            return {
              outputs: existing.map((output) => output.id),
            };
          }),
      };
      return {
        secrets: {
          global: { get: (s: string) => Config.string(s) },
          user: {
            get: (s: string) => {
              // Not implemented
            },
          },
        },
        config: { get: () => config },
        competitions,
        hooks: { do: doHook },
        tracks,
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
