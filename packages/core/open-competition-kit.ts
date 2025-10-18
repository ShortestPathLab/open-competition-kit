import { Effect as E } from "effect";
import { OpenCompetitionKitHooks } from "hook";

export class OpenCompetitionKit extends E.Service<OpenCompetitionKit>()(
  "open-competition-kit/OpenCompetitionKit",
  {
    effect: E.gen(function* () {
      const hooks = yield* OpenCompetitionKitHooks;
      return {
        hooks,
      };
    }),
  }
) {}
