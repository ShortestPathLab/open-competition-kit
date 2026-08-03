/**
 * What crosses between the host and an evaluation program.
 *
 * Deliberately the smallest thing every language already has: read a JSON file,
 * write a JSON file. No arguments to parse, no stream to keep clean, no framing
 * to agree on, and nothing injected beside the program that has to understand
 * it. That is the whole reason this package knows no language: a Go binary, a
 * shell script and a Python file all open two files.
 *
 * Gathered here because these are the constants the host writes and a program
 * reads, and a disagreement shows up as an evaluation that fails with a missing
 * file rather than as anything that names the real cause.
 */

/**
 * The protocol version, sent with every request.
 *
 * Worth reading if you are writing a program against this. The shape below is
 * the only contract there is, and a program that checks this is a program that
 * finds out at the right moment when the shape changes.
 */
export const PROTOCOL = 1;

/**
 * Where the organiser's files land, and where the command runs.
 *
 * Everything under `include:` goes here, keyed by the relative path it was
 * written under, so `command: ["python3", "evaluate.py"]` finds the file called
 * `evaluate.py`.
 */
export const WORK = "/ock/work";

/**
 * Where a submission's permitted files land.
 *
 * Beside the program rather than over a harness, so a program decides for itself
 * where they belong. A competition whose image holds a harness copies them onto
 * it; one whose submission is the whole answer reads them where they are.
 */
export const SUBMISSION = "/ock/submission";

/**
 * The request, beside everything else the kit puts in.
 *
 * Under `/ock` rather than `/tmp` so that the kit injects into exactly one
 * directory, which it creates. Injected files carry the ownership of whoever
 * runs the runner service on the host, and a directory shared with the image is
 * a directory whose permissions somebody has to reason about.
 */
export const REQUEST = "/ock/request.json";

/**
 * The reply, in the one place any image will let any user write.
 *
 * Not beside the request: `/ock` belongs to the host's user, and an image with a
 * `USER` of its own cannot write there. /tmp is world-writable in every image
 * worth evaluating in, and nothing is ever injected into it, so it keeps the
 * mode the image gave it.
 *
 * A file rather than standard output because a program's own output belongs to
 * the program. An evaluation prints whatever its harness printed, and an answer
 * parsed out of that stream would be at the mercy of it. Both streams are the
 * job's log and nothing else.
 *
 * The request carries this path too. Read it from there rather than hardcoding
 * it, and a protocol that moves the file later moves it without touching your
 * program.
 */
export const REPLY = "/tmp/ock-reply.json";

export type Phase = "plan" | "evaluate" | "reduce";

export type Request = {
  protocol: number;
  phase: Phase;
  job: string;
  /** Where to write the reply. */
  reply: string;
  /** Whatever `params:` said, untouched. */
  params: Record<string, unknown>;
  /** The case being evaluated, as `plan` described it. Only on `evaluate`. */
  case?: unknown;
  /** Where the submission's permitted files are. Only on `evaluate`. */
  submission?: { root: string; files: readonly string[] };
  /** What every case returned, and the cases themselves. Only on `reduce`. */
  results?: readonly unknown[];
  cases?: readonly unknown[];
};

/**
 * What the program writes back.
 *
 * `value: null` means "I do not implement this phase", and the host fills in
 * what it would have done: one unnamed case for `plan`, and the numbers added up
 * for `reduce`. That is what lets a program that only scores one thing handle
 * one phase and ignore the other two.
 */
export type Reply = { ok: true; value: unknown } | { ok: false; error: string };
