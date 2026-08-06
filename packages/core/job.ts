/**
 * The statuses a job moves through, in one place because claiming depends on
 * spelling them identically.
 *
 * They were string literals scattered across the runner service, the standard
 * package and every runner. That was survivable while the only thing reading a
 * status was a badge in the UI. It stops being survivable once a compare-and-set
 * guards on one: a runner writing `"Running"` against a guard expecting
 * `"running"` does not fail, it silently never claims anything.
 *
 * Not an enum in the config's vocabulary. A package is free to invent statuses
 * of its own, and several do; these are the ones core itself acts on.
 */
export const JobStatus = {
  /** Created and waiting for a runner to take it. */
  pending: "pending",
  /** Claimed by a runner, which holds it until it writes a terminal status. */
  running: "running",
  /** Evaluated. Whatever it produced is in its outputs. */
  done: "done",
  /** Evaluation was attempted and failed. Terminal: nothing retries it. */
  error: "error",
  /** No installed runner answered for it. Terminal, and usually a config problem. */
  skipped: "skipped",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/** Statuses nothing will move a job out of, so a sweep can leave them alone. */
export const TERMINAL: readonly string[] = [JobStatus.done, JobStatus.error, JobStatus.skipped];

export const isTerminal = (status: string) => TERMINAL.includes(status);

/**
 * How long a claim is trusted before a sweep may take the job back.
 *
 * Generous by default because a claim is not refreshed while the job runs, so
 * this has to exceed the longest evaluation any competition on the host will
 * legitimately take. Set it too low and a slow submission is reaped and run
 * twice; there is no correctness argument for a small number here, only
 * impatience.
 *
 * A heartbeat that touched `claimedAt` periodically would let this be minutes
 * instead of hours, and is the obvious next step. It is not here because the
 * sweep is a backstop for a crashed process, and a crashed process is rare
 * enough that waiting an hour to notice costs less than the machinery.
 */
export const DEFAULT_STALE_CLAIM_MS = 60 * 60 * 1000;

/** Enough of a job row to decide whether its claim has expired. */
export type ClaimedJob = { id: string; status: string; claimedAt: string };

/**
 * Which held jobs look abandoned, given the oldest claim still worth trusting.
 *
 * Separated from the write so the rule can be read and tested on its own, and
 * because getting it wrong in the unsafe direction reruns somebody's evaluation
 * while it is still going. A job with no stamp is left alone rather than treated
 * as infinitely old: an empty `claimedAt` on a running row means something wrote
 * the status without going through a claim, and the sweep is not the thing that
 * should decide what to do about that.
 */
export const staleClaims = <T extends ClaimedJob>(held: readonly T[], before: string): T[] =>
  held.filter(
    (job) => job.status === JobStatus.running && job.claimedAt !== "" && job.claimedAt < before,
  );
