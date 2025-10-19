import { OpenCompetitionKitDatabase } from "./db";
import { Effect as E } from "effect";
import type { OpenCompetitionKitApi } from "./api";
import { OpenCompetitionKitConfig } from "./config";

export class OpenCompetitionKit extends E.Service<OpenCompetitionKit>()(
  "open-competition-kit/OpenCompetitionKit",
  {
    effect: E.gen(function* () {
      const { config } = yield* OpenCompetitionKitConfig;
      const db = yield* OpenCompetitionKitDatabase;
      const instance = yield* db();
      const connect = yield* E.once(instance.connect());
      const competitions = {
        get: (id: string) =>
          connect.pipe(E.andThen(instance.one("competitions", id))),
        list: () => connect.pipe(E.andThen(E.succeed(1))),
      };
      return {
        config: { get: () => config },
        competitions,
      } satisfies OpenCompetitionKitApi;
    }),
  }
) {}
