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
      const users = yield* collectionFrom(
        instance.users,
        () => E.fail(new CollectionOwnerError()),
        () => instance.users.list({}),
      );
      const tracks = yield* collectionFrom(
        instance.tracks,
        (track) => competitions.get(track.competition),
        (competition) => instance.tracks.list({ competition: competition.id }),
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
      const enrolments = {
        ...enrolmentCollection,
        enrol: (userId: string, trackId: string) =>
          E.gen(function* () {
            const existing = yield* instance.enrolments.list({
              user: userId,
              track: trackId,
            });

            if (existing[0]) return existing[0];

            return yield* instance.enrolments.create({
              user: userId,
              track: trackId,
            });
          }),
      };
      return {
        config: { get: () => config },
        competitions,
        hooks: {
          do: <U>(call: (h: Hooks) => U, ...w: Parameters<typeof hooks.get>) =>
            E.provideService(
              hooks.get(...w).pipe(E.map(call)),
              Path.Path,
              path,
            ),
        },
        tracks,
        users,
        enrolments,
      } satisfies OpenCompetitionKitApi;
    }),
  },
) {}
