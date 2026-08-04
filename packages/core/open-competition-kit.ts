import { Config, Effect as E } from "effect";
import { isUndefined } from "es-toolkit";
import type { OpenCompetitionKitApi } from "./api";
import { access, type Accessor } from "./config/access";
import { createNamespacedContext } from "./kit/context-store";
import { createEntities } from "./kit/entities";
import { MissingContextError } from "./kit/errors";
import { createFileStore } from "./kit/file-store";
import { createParticipation } from "./kit/participation";
import { makeRuntime } from "./kit/runtime";
import { createMachine } from "./kit/machine";

export * from "./kit/errors";
export { withCollectionUtilities, withMergeConfig } from "./kit/collection-utils";
export type { MachineRequest } from "./kit/machine";

export class OpenCompetitionKit extends E.Service<OpenCompetitionKit>()(
  "open-competition-kit/OpenCompetitionKit",
  {
    effect: E.gen(function* () {
      const runtime = yield* makeRuntime;
      const { config, configService, hooks, instance } = runtime;

      const entities = createEntities(runtime);
      const participation = createParticipation(runtime, entities);
      const files = createFileStore(hooks, instance);
      const machine = createMachine(hooks);

      const secrets = {
        global: {
          get: (s: string) =>
            E.gen(function* () {
              return config.secrets && s in config.secrets ?
                  config.secrets[s]
                : yield* Config.string(s);
            }),
          require: (s: string) =>
            E.gen(function* () {
              const c = yield* secrets.global.get(s);
              if (isUndefined(c)) return yield* E.fail(new MissingContextError());
              return c;
            }),
        },
        user: createNamespacedContext(instance)(
          "open-competition-kit/namespace/user/secret",
        ),
      };

      return {
        secrets,
        config: {
          get: () => config,
          access: <T extends Accessor>(accessor: T) => access(accessor, config),
          /**
           * Every editable node, with the package fields that apply to it.
           *
           * What a config editor renders a form from: labels, descriptions and
           * current values, contributed by whichever packages the organiser
           * installed. Serialisable, so it crosses to the browser; the schemas
           * that produced it do not and stay on this side.
           */
          describe: () => configService.describe,
        },
        ...entities,
        ...participation,
        files,
        machine,
        hooks,
      } satisfies OpenCompetitionKitApi;
    }),
  },
) {}
