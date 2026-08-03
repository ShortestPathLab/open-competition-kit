/**
 * What crosses between the host and an evaluation program.
 *
 * Deliberately the smallest thing every language already has: read a JSON file,
 * write a JSON file. No arguments to parse, no stream to keep clean, no framing
 * to agree on. A program in a language this package has never heard of talks to
 * it by opening two files.
 *
 * Gathered here because these are the constants a shim and the runner have to
 * agree on exactly, and a disagreement shows up as an evaluation that fails with
 * a missing file rather than as anything that names the real cause.
 */

/**
 * The protocol version, sent with every request.
 *
 * A program written against a `runtime:` shim never sees it, since the shim is
 * injected by the same package that writes the request. It is for the programs
 * that speak this directly through `command:`, which is where a host and a
 * program can genuinely disagree about the shape.
 */
export const PROTOCOL = 1;

/** The directory the organiser's program and its `include:` files land in. */
export const WORK = "/ock/work";

/**
 * The program, at a path with no extension.
 *
 * Named for what it is rather than for a language, since which interpreter opens
 * it is the config's business. A shim knows this path; a `command:` is told it
 * in the request and may point at whatever it likes instead.
 */
export const PROGRAM = `${WORK}/program`;

/** Where a shim lands. Only the one a `runtime:` names is ever injected. */
export const SHIM = "/ock/shim";

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
 * runs the runner service on the host, and a directory that has to be shared
 * with the image is a directory whose permissions somebody has to reason about.
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
 */
export const REPLY = "/tmp/ock-reply.json";

export type Phase = "plan" | "evaluate" | "reduce";

export type Request = {
  protocol: number;
  phase: Phase;
  job: string;
  /** Where the program and its `include:` files are, for a `command:` to find. */
  program: string;
  /** Where to write the reply. */
  reply: string;
  params: Record<string, unknown>;
  /** The case being evaluated. Only on `evaluate`. */
  case?: unknown;
  /** Where the submission's permitted files are. Only on `evaluate`. */
  submission?: { root: string; files: readonly string[] };
  /** What every case returned, and the cases themselves. Only on `reduce`. */
  results?: readonly unknown[];
  cases?: readonly unknown[];
};

/** What the program writes back. */
export type Reply = { ok: true; value: unknown } | { ok: false; error: string };
