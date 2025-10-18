import { BunContext } from "@effect/platform-bun";
import { Console, Effect as E, Layer as L } from "effect";
import {
  OpenCompetitionKitConfig,
  OpenCompetitionKitHooks,
  OpenCompetitionKit,
} from ".";

const OpenCompetitionKitHooksLive = L.provide(
  OpenCompetitionKitHooks.Default,
  OpenCompetitionKitConfig.Default
);

const OpenCompetitionKitLive = L.provide(
  OpenCompetitionKit.Default,
  OpenCompetitionKitHooksLive
);

await E.runPromise(
  E.gen(function* () {
    const kit = yield* OpenCompetitionKit;
    const { db } = yield* kit.hooks.get((c) => c);
    const result = yield* E.promise(() => db.connect());
    return yield* Console.log(result);
  }).pipe(E.provide(OpenCompetitionKitLive), E.provide(BunContext.layer))
);
