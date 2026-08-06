/**
 * A port to ask the runner whether it is still working.
 *
 * The runner has no HTTP surface otherwise, and that was fine while the only
 * thing watching it was a person reading logs. It stops being fine in a
 * deployment: a runner whose poll loop has wedged looks exactly like a healthy
 * idle runner from the outside, so Compose keeps it, an orchestrator keeps it,
 * and submissions quietly stop being evaluated with nothing anywhere reporting a
 * problem.
 *
 * What it answers is the poll loop's own liveness rather than "the process is
 * running", which the process answering at all already proves. A poll that has
 * not completed in several intervals is either stuck on one very long evaluation
 * or not coming back, and from outside those look the same, so the reply says
 * which it thinks it is and lets the operator set the threshold.
 */
const DEFAULT_PORT = 3001;

export const portFrom = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === "") return DEFAULT_PORT;
  // An explicit `0` or `off` is how a deployment that does not want a listening
  // socket says so, rather than having to leave the variable at a port nobody
  // reaches.
  if (raw.trim() === "0" || raw.trim().toLowerCase() === "off") return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.warn(
      `[runner-service] OCK_RUNNER_HEALTH_PORT is "${raw}", which is not a port. ` +
        `Using ${DEFAULT_PORT}.`,
    );
    return DEFAULT_PORT;
  }
  return parsed;
};

/**
 * How long the loop may sit idle before that means something is wrong.
 *
 * Fifteen poll intervals. The loop schedules the next tick the moment the last
 * one finishes, so an idle runner should never be more than one interval behind,
 * and being fifteen behind is not a slow day.
 */
export const DEFAULT_IDLE_TOLERANCE_MS = 30_000;

export type HealthReport = {
  status: "ok" | "stalled";
  /** Milliseconds since a poll last finished, or since the service started. */
  sinceLastPollMs: number;
  /** Whether a poll is in flight right now, which is the ordinary busy case. */
  polling: boolean;
};

/**
 * Whether being this far behind is a problem.
 *
 * Only when the loop is idle. A poll in flight has not returned yet, and it does
 * not return until every evaluation it started has finished, so a long gap while
 * `polling` is true is what a thirty minute submission looks like from here.
 * Failing the check on that would restart a runner in the middle of the work it
 * was hired for.
 *
 * Idle and overdue is unambiguous: the loop reschedules itself the instant a poll
 * resolves, so if nothing is running and nothing has finished recently, nothing
 * is going to.
 *
 * The remaining case, a poll wedged in flight forever, reads as `polling: true`
 * with a gap that keeps growing. Telling that from a legitimately long evaluation
 * needs to know how long evaluations here take, which this service does not, so
 * it reports both numbers and leaves that alert to whoever does.
 */
export const reportOn = (
  sinceLastPollMs: number,
  polling: boolean,
  toleranceMs: number,
): HealthReport => ({
  status: !polling && sinceLastPollMs > toleranceMs ? "stalled" : "ok",
  sinceLastPollMs,
  polling,
});

/**
 * Serve the report on `/health`, or do not serve anything.
 *
 * Returns `undefined` when the port is switched off, and when the socket cannot
 * be bound. Neither is a reason to take the service down: a runner that cannot
 * open a health port can still evaluate every submission in the queue, and
 * refusing to start over the thing that reports whether you started would be a
 * poor trade. It says so and carries on.
 */
export const serveHealth = (report: () => HealthReport) => {
  const port = portFrom(process.env.OCK_RUNNER_HEALTH_PORT);
  if (port === undefined) return undefined;

  try {
    const server = Bun.serve({
      port,
      fetch(request) {
        const { pathname } = new URL(request.url);
        if (pathname !== "/health") return new Response("Not found", { status: 404 });

        const body = report();
        return Response.json(body, {
          // Non-200 when stalled, because a probe reads the code and not the
          // body, and a stalled runner that answers 200 is worse than one that
          // does not answer at all: it is a green tick over a queue nobody is
          // draining.
          status: body.status === "ok" ? 200 : 503,
          headers: { "cache-control": "no-store" },
        });
      },
    });
    return { port: server.port, stop: () => void server.stop(true) };
  } catch (error) {
    console.warn(`[runner-service] could not listen on :${port} for health checks`, error);
    return undefined;
  }
};
