import { type Package } from "@open-competition-kit/sdk";
import { local, type Run } from "./machine";

export * from "./machine";

/**
 * Somewhere to run a command, for a deployment that has not said where.
 *
 * A default package, and one of the few that can be: it declares no config at
 * all. That is not an oversight but the argument the `machine` block makes for
 * itself, that the package doing the confining should be the one declaring what
 * it can be told. This one confines almost nothing, so it says almost nothing.
 *
 * Innermost, like every default, which is what makes it a fallback rather than a
 * choice. A machine an organiser installs sits outside this one and simply
 * answers, and this is never reached. Being last to be asked is the whole point:
 * a competition can be written, run and scored before anybody decides how it will
 * be deployed, so the decision that gets deferred is the one about containers
 * rather than the one about what a good evaluation is.
 */
export default {
  name: "@open-competition-kit/machine-local",
  description:
    "Runs a command as a child process of the runner service, as the machine you get when no other is installed.",
  version: "0.0.11",
  machine: {
    build: async (recipe, next) => (await next?.(recipe)) ?? (await local.build()),
    run: async (request: Run, next) => (await next?.(request)) ?? (await local.run(request)),
  },
} satisfies Package;
