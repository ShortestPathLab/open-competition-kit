/**
 * Noticing that the config changed, and standing down.
 *
 * Both services read `competition.config.yaml` at startup, and only one of them
 * has a settings page. When an organiser saves a change and restarts the UI, the
 * runner is still evaluating against the config it read yesterday, and nothing
 * in the UI can reach into another container to fix that. So the runner watches
 * the file itself.
 *
 * Two things make this safe to do without asking anybody. It waits until no job
 * is being evaluated, because a container that exits mid-evaluation leaves a
 * submission marked as running that nothing is running. And it stops taking new
 * work the moment it sees the change, because a busy runner that only leaves
 * when it is idle would never leave.
 */
export type ConfigWatch = {
  /** Something about the file that changes when the file does. */
  stamp: () => Promise<string | undefined>;
  /** Whether a job is being evaluated right now. */
  busy: () => boolean;
  /** Stop taking new work, so that idle is reachable. */
  drain: () => void;
  /** Stop the process, for whatever started it to start again. */
  restart: () => Promise<unknown>;
  log?: (message: string) => void;
};

/**
 * A check to run on a timer.
 *
 * The first call only learns what the file looks like now. There is no earlier
 * reading to compare against, and treating "I have not looked before" as a
 * change would restart the service on startup, for ever.
 */
export function createConfigWatch({ stamp, busy, drain, restart, log = console.log }: ConfigWatch) {
  let known: string | undefined;
  let draining = false;

  return async () => {
    if (!draining) {
      const now = await stamp();

      // Unreadable for a moment is not the same as changed. A file being
      // replaced is missing for the instant between the write and the rename.
      if (now === undefined) return;

      if (known === undefined) {
        known = now;
        return;
      }

      if (now === known) return;

      draining = true;
      log("The config file changed. Finishing what is running, then restarting.");
      drain();
    }

    if (busy()) return;

    await restart();
  };
}
