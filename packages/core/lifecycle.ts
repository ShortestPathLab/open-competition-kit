/**
 * Stopping the service so it comes back with the new config.
 *
 * Config is read once, at startup. Everything downstream closes over the result:
 * the hook chain is built from the `with:` lists, the database connects from the
 * `db:` block, and authentication is configured from `auth:`. Rebuilding all of
 * that under live requests is a different and much larger feature than saving a
 * file, so applying a config change means starting again.
 *
 * Which makes restarting somebody else's job. This process can stop; only
 * whatever started it can start it again. Docker Compose does with a `restart:`
 * policy, Kubernetes always does, and `bun run` in a terminal never does. The
 * honest interface is therefore two calls: one that says what stopping would
 * mean here, and one that stops.
 */
import { Effect as E } from "effect";

/** What restarting would do in this deployment. */
export type RestartSupport = {
  /** Whether this process will stop when asked. */
  restartable: boolean;
  reason:
    | "ok"
    /** A dev server, where exiting leaves nothing running and nobody to notice. */
    | "development"
    /** Turned off with `OCK_RESTART=off`. */
    | "disabled";
  /** A sentence for whoever is about to press the button. */
  detail: string;
  /**
   * What was recognised around the process, when anything was.
   *
   * Best effort and deliberately not load bearing. A container tells us it is a
   * container and cannot tell us whether it was started with a restart policy,
   * so this narrows the wording rather than deciding it.
   */
  supervisor?: "container" | "kubernetes" | "systemd";
};

/** How long the caller has to finish answering the request that asked for this. */
const GRACE_MS = 250;

const env = (name: string) => process.env[name];

const supervisorOf = (): RestartSupport["supervisor"] => {
  if (env("KUBERNETES_SERVICE_HOST")) return "kubernetes";
  // Set by systemd for every unit it starts, and by nothing else.
  if (env("INVOCATION_ID")) return "systemd";
  if (env("OCK_IN_CONTAINER") === "1") return "container";
  return undefined;
};

const detailFor = (supervisor: RestartSupport["supervisor"]) => {
  switch (supervisor) {
    case "kubernetes":
      return "Restarting stops this container. Kubernetes starts a new one straight away.";
    case "systemd":
      return "Restarting stops this service. systemd starts it again if the unit says to.";
    case "container":
      return (
        "Restarting stops this container. It comes back on its own if the deployment " +
        "gives it a restart policy, as the kit's compose file does."
      );
    default:
      return (
        "Restarting stops the service. It comes back only if whatever started it is set " +
        "up to start it again."
      );
  }
};

/**
 * Whether this process will stop when asked, and what that means here.
 *
 * The development case is the one worth refusing. A dev server exits and stays
 * exited, so the button would take the site away from the person pressing it,
 * and the config it was going to apply is a file they can restart by hand.
 */
export const restartSupport = (): RestartSupport => {
  if (env("OCK_RESTART") === "off") {
    return {
      restartable: false,
      reason: "disabled",
      detail: "Restarting from the dashboard is turned off with OCK_RESTART=off.",
    };
  }

  if (env("OCK_RESTART") !== "on" && env("NODE_ENV") === "development") {
    return {
      restartable: false,
      reason: "development",
      detail:
        "This is a development server, which nothing would start again. Restart it yourself " +
        "to pick up the change.",
    };
  }

  const supervisor = supervisorOf();

  return {
    restartable: true,
    reason: "ok",
    detail: detailFor(supervisor),
    ...(supervisor ? { supervisor } : {}),
  };
};

/**
 * Stop, shortly.
 *
 * Not immediately: the request that asked for this still has a response to send,
 * and a caller that never hears back cannot tell a restart from a crash. The
 * short wait is the difference between "restarting" and a browser error page.
 *
 * Exit code 0, because this is an ordinary shutdown. A supervisor configured
 * with `on-failure` deliberately will not restart it, and that is the setting
 * saying so rather than a bug.
 */
export const restart = (): E.Effect<RestartSupport> =>
  E.gen(function* () {
    const support = restartSupport();
    if (!support.restartable) return support;

    yield* E.logInfo("Restarting to apply a configuration change.");

    setTimeout(() => process.exit(0), GRACE_MS).unref?.();

    return support;
  });
