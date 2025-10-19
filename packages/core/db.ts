import { OpenCompetitionKitHooks } from "core/hook";
import { Effect as E } from "effect";

export class OpenCompetitionKitDatabase extends E.Service<OpenCompetitionKitDatabase>()(
  "open-competition-kit/OpenCompetitionKitDatabase",
  {
    effect: E.gen(function* () {
      const hooks = yield* OpenCompetitionKitHooks;
      return (...a: Parameters<typeof hooks.get>) =>
        E.gen(function* () {
          const api = yield* hooks.get(...a);
          return {
            competitions: {
              list: hooks.try(api.db.competitions.list),
              create: hooks.try(api.db.competitions.create),
            },
          };
        });
    }),
  }
) {}
