import { OpenCompetitionKitHooks } from "core/hook";
import { Array as A, Effect as E } from "effect";

export class OpenCompetitionKitDatabase extends E.Service<OpenCompetitionKitDatabase>()(
  "open-competition-kit/OpenCompetitionKitDatabase",
  {
    effect: E.gen(function* () {
      const hooks = yield* OpenCompetitionKitHooks;
      return (...a: Parameters<typeof hooks.get>) =>
        E.gen(function* () {
          const api = yield* hooks.get(...a);
          return {
            connect: hooks.try(api.db.connect),
            one: (store: string, id: string) =>
              hooks
                .try(api.db.query)({
                  from: store,
                  where: `id="${id}"`,
                  select: [],
                })
                .pipe(E.andThen(A.head)),
          };
        });
    }),
  }
) {}
