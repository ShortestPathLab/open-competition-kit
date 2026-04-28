import { Path } from "@effect/platform";
import { Data as D, Effect as E, Match as M } from "effect";
import { noop } from "lodash-es";
import type { OpenCompetitionKitApi } from "./api";
import { OpenCompetitionKitCollections } from "./collections";
import { OpenCompetitionKitConfig } from "./config";
import { Hooks, OpenCompetitionKitHooks } from "./hook";
import type { schemas, WithHooks } from "./hook/db";

export class CollectionOwnerError extends D.TaggedError(
  "CollectionOwnerError",
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
    };
  });
}

export class OpenCompetitionKit extends E.Service<OpenCompetitionKit>()(
  "open-competition-kit/OpenCompetitionKit",
  {
    effect: E.gen(function* () {
      const path = yield* Path.Path;
      const { config } = yield* OpenCompetitionKitConfig;
      const hooks = yield* OpenCompetitionKitHooks;
      const db = yield* OpenCompetitionKitCollections;
      const instance = yield* db();
      const competitions = yield* collectionFrom(
        instance.competitions,
        () => E.fail(new CollectionOwnerError()),
        () => instance.competitions.list({}),
      );
      const userCollection = yield* collectionFrom(
        instance.users,
        () => E.fail(new CollectionOwnerError()),
        () => instance.users.list({}),
      );
      const users = {
        ...userCollection,
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
      const submissions = yield* collectionFrom(
        instance.submissions,
        (submission) => tracks.get(submission.track),
        (track) => instance.submissions.list({ track: track.id }),
      );
      const jobs = yield* collectionFrom(
        instance.jobs,
        (job) => submissions.get(job.submission),
        (submission) => instance.jobs.list({ submission: submission.id }),
      );
      const outputs = yield* collectionFrom(
        instance.outputs,
        (output) => jobs.get(output.job),
        (job) => instance.outputs.list({ job: job.id }),
      );
      const enrolmentCollection = yield* collectionFrom(
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
      );
      const doHook = <U>(
        call: (h: Hooks) => U,
        ...w: Parameters<typeof hooks.get>
      ) => E.provideService(hooks.get(...w).pipe(E.map(call)), Path.Path, path);
      const enrolments = {
        ...enrolmentCollection,
        isEnrolled: (user: string, competition: string, track: string) =>
          E.gen(function* () {
            const enrolments = yield* enrolmentCollection.list({
              track,
              competition,
              user,
            });
            return !!enrolments.length;
          }),
        enrol: (user: string, competition: string, track: string) =>
          doHook(
            (h) => h.enrolments.enrol({ user, track, competition }),
            (c) =>
              c.competitions
                .find((c) => c.id === competition)
                ?.tracks?.find((t) => t.id === track)!,
          ),
      };
      const base = {
        config: { get: () => config },
        competitions,
        hooks: { do: doHook },
        tracks,
        users,
        enrolments,
      } satisfies OpenCompetitionKitApi;
      return Object.assign(base, {
        submissions,
        jobs,
        outputs,
      });
    }),
  },
) {}
