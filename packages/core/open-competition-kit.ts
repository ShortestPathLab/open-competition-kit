import { Data, Effect as E } from "effect";
import type { OpenCompetitionKitApi } from "./api";
import { OpenCompetitionKitConfig } from "./config";
import { OpenCompetitionKitDatabase } from "./db";
import type { WithHooks } from "./hook/db";

export class CollectionOwnerError extends Data.TaggedError(
  "CollectionOwnerError"
) {}

export function collectionApiFrom<T, U, E1, E2, E3, C1, C2, C3>(
  table: WithHooks<T, E1, C1>,
  owner: (item: T) => E.Effect<U, E2, C3>,
  of: (owner: U) => E.Effect<Readonly<T[]>, E3, C2>
) {
  return E.gen(function* () {
    return {
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
      const db = yield* OpenCompetitionKitDatabase;
      const instance = yield* db();
      const competitions = yield* collectionApiFrom(
        instance.competitions,
        () => E.fail(new CollectionOwnerError()),
        () => instance.competitions.list({})
      );
      const tracks = yield* collectionApiFrom(
        instance.tracks,
        (track) => competitions.get(track.competition),
        (competition) => instance.tracks.list({ competition: competition.id })
      );
      return {
        config: { get: () => config },
        competitions,
        tracks,
      } satisfies OpenCompetitionKitApi;
    }),
  }
) {}
