import { Data as D, Effect as E, Match as M } from "effect";
import type { OpenCompetitionKitApi } from "./api";
import { OpenCompetitionKitConfig } from "./config";
import { OpenCompetitionKitCollections } from "./collections";
import type { schemas, WithHooks } from "./hook/db";
import { noop } from "lodash-es";
import { OpenCompetitionKitHooks } from "./hook";

export class CollectionOwnerError extends D.TaggedError(
  "CollectionOwnerError",
) {}

export function collectionFrom<T, U1, E1, E2, E3, C1, C2, C3, U2 = U1>(
  table: WithHooks<T, E1, C1>,
  owner: (item: T) => E.Effect<U1, E2, C3>,
  of: (owner: U2) => E.Effect<Readonly<T[]>, E3, C2>,
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
      const { config } = yield* OpenCompetitionKitConfig;
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
      const enrolments = yield* collectionFrom(
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
      return {
        config: { get: () => config },
        competitions,
        tracks,
        users,
        enrolments,
        hooks: undefined,
      } satisfies OpenCompetitionKitApi;
    }),
  },
) {}
