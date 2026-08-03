/**
 * Where things live inside an evaluation container, and what crosses between
 * the host and the program.
 *
 * Gathered in one file because these are the constants the shim and the runner
 * have to agree on exactly, and a disagreement shows up as an evaluation that
 * fails with a missing file rather than as anything that names the real cause.
 */

/**
 * The protocol version, sent with every request.
 *
 * A program never sees this: the shim is injected by the same package that
 * writes the request, so the two always match. It exists for the log, and for
 * the day a stale image has an old shim baked into it somehow.
 */
export const PROTOCOL = 1;

/** The shim, and the directory the organiser's files land in. */
export const SHIM = "/ock/shim.py";
export const WORK = "/ock/work";
export const PROGRAM = `${WORK}/program.py`;

/**
 * Where a submission's permitted files land.
 *
 * Beside the program rather than over the harness, so a program decides for
 * itself where they belong. A competition whose image holds a harness calls
 * `submission.copy_into("/runner")`; one whose submission is the whole answer
 * reads them where they are.
 */
export const SUBMISSION = "/ock/submission";

/**
 * Where the request is left for the shim to read.
 *
 * Under /tmp rather than beside the program, because `docker cp` gives injected
 * files the ownership of whoever runs the runner service on the host, and an
 * image with a `USER` of its own may not be able to read a directory it does
 * not own. /tmp is world-readable and world-writable in every image worth
 * evaluating in.
 */
export const REQUEST = "/tmp/ock-request.json";

/**
 * The reply comes back on standard output, and standard output belongs to the
 * shim alone.
 *
 * A container is removed the moment it exits, so a file written inside it is
 * gone before anything could read it, and a stream is the only way out. The shim
 * takes fd 1 for itself before the program runs and points the program's at fd
 * 2, so everything printed by the program, by the harness, and by whatever a
 * submission spawned lands in the log where it belongs. Nothing but the shim can
 * write to the channel the answer travels on, which is what makes a submission
 * unable to report its own score.
 *
 * An empty standard output therefore means the shim never got to reply: killed
 * on the wall clock, killed by the OOM killer, or an image with no `python3`.
 */

export type Phase = "plan" | "evaluate" | "reduce";

export type Request = {
  protocol: number;
  phase: Phase;
  job: string;
  params: Record<string, unknown>;
  /** The case being evaluated. Only on `evaluate`. */
  case?: unknown;
  /** Where the submission's permitted files are. Only on `evaluate`. */
  submission?: { root: string; files: readonly string[] };
  /** What every case returned, and the cases themselves. Only on `reduce`. */
  results?: readonly unknown[];
  cases?: readonly unknown[];
};

/** What the shim writes back. */
export type Reply =
  | { ok: true; value: unknown }
  | { ok: false; error: string };
