import { Path } from "@effect/platform";
import { Effect as E } from "effect";
import { OpenCompetitionKitCollections } from "../collections";
import { OpenCompetitionKitConfig } from "../config";
import { Hooks, OpenCompetitionKitHooks } from "../hook";

/**
 * What every part of the kit closes over: the config, the database collections,
 * and a way to call into the installed packages.
 *
 * Built once so each slice below can be a plain function of it rather than
 * another `E.gen` that has to re-acquire the same services.
 */
export const makeRuntime = E.gen(function* () {
  const path = yield* Path.Path;
  const configService = yield* OpenCompetitionKitConfig;
  const config = yield* configService.config;
  const hooksService = yield* OpenCompetitionKitHooks;

  const hooks = {
    do: <U>(call: (h: Hooks) => Promise<U>, ...w: Parameters<typeof hooksService.get>) =>
      E.provideService(hooksService.get(...w).pipe(E.andThen(call)), Path.Path, path),
  };

  const db = yield* OpenCompetitionKitCollections;
  const instance = yield* db();

  return { path, configService, config, hooks, instance };
});

export type Runtime = E.Effect.Success<typeof makeRuntime>;
export type Instance = Runtime["instance"];
export type HookRunner = Runtime["hooks"];
