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
      const competitions = {
        list: () => instance.competitions.list({}),
        create: () =>
          instance.competitions.create({
            name: "Random",
          }),
        get: () => {
          throw new Error();
        },
      };
      return {
        config: { get: () => config },
        competitions,
      } satisfies OpenCompetitionKitApi;
    }),
  }
) {}
