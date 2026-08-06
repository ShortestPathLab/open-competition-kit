import { Config, Effect as E } from "effect";
import { isUndefined } from "es-toolkit";
import type { OpenCompetitionKitApi } from "./api";
import { access, type Accessor } from "./config/access";
import type { ConfigEdit } from "./config/write";
import { createNamespacedContext } from "./kit/context-store";
import { createEntities } from "./kit/entities";
import { MissingContextError } from "./kit/errors";
import { createFileStore } from "./kit/file-store";
import { restart, restartSupport } from "./lifecycle";
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
              return config.secrets && s in config.secrets
                ? config.secrets[s]
                : yield* Config.string(s);
            }),
          require: (s: string) =>
            E.gen(function* () {
              const c = yield* secrets.global.get(s);
              if (isUndefined(c)) return yield* E.fail(new MissingContextError());
              return c;
            }),
        },
        user: createNamespacedContext(instance)("open-competition-kit/namespace/user/secret"),
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
          /**
           * The file the config was read from, resolved.
           *
           * `CONFIG` may name it and the search walks upwards from the working
           * directory, so the file an organiser is looking at is not always the
           * one running. A settings page that tells somebody to edit a file owes
           * them the path to the right one.
           */
          path: () => configService.path,
          /**
           * Whether a change could be saved, and why not when it could not.
           *
           * Worth asking before drawing the form. A config file mounted read
           * only is a normal way to deploy this, and an editor that only finds
           * out when somebody presses Save has already wasted their afternoon.
           */
          writable: () => configService.writable,
          /**
           * Edited values, sent back the way they were handed out.
           *
           * Paired with `describe`: an editor renders fields from that and
           * returns them here, keyed by the same dotted paths, so neither end
           * has to know which package owns which field. The values are checked
           * against those packages' own schemas, placed back in the config file
           * with its comments intact, and only saved once the edited file has
           * been loaded from scratch and found to boot.
           *
           * Takes effect at the next start. See `lifecycle.restart`.
           */
          set: (edits: readonly ConfigEdit[]) => configService.set(edits),
        },
        /**
         * Starting again, which is how a config change takes effect.
         *
         * Kept away from `config` on purpose. Restarting is a thing done to the
         * process rather than to the configuration, and the runner service has
         * reason to do it without anybody editing anything.
         */
        lifecycle: {
          support: () => E.sync(restartSupport),
          restart: () => restart(),
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
