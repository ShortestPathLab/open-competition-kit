import sdk, {
  jobs,
  outputs,
  reference,
  sandbox,
  source,
  submissions,
  tracks,
  unsafe,
  type Package,
} from "@open-competition-kit/sdk";
import { config, script, type ScriptRunner } from "./config";
import {
  PROGRAM,
  PROTOCOL,
  REQUEST,
  SHIM,
  SUBMISSION,
  WORK,
  type Phase,
  type Reply,
  type Request,
} from "./protocol";
import { row, type Scalar } from "./row";
import shim from "./shim.py" with { type: "text" };

/**
 * Evaluating a competition with a program instead of a package.
 *
 * The organiser writes one file. It defines `evaluate`, and optionally `plan`
 * and `reduce`, and this package runs each in its own container: `plan` once to
 * find out what there is to do, `evaluate` once per case, and `reduce` once to
 * turn the results into the row a leaderboard reads.
 *
 * ## Why a container per case rather than one for the whole evaluation
 *
 * Because the alternative gives one submission the run of its own evaluation.
 * Case three exhausting its memory would take cases four through forty with it,
 * a wedged interpreter would strand the lot, and the wall-clock limit would have
 * to be generous enough for the entire suite, which makes it barely a limit.
 * Fanning out costs a container start per case and buys a blast radius of one.
 *
 * `plan` and `reduce` run with no submission in the container, which keeps the
 * scoring step out of reach of the code being scored. A program that measures in
 * `evaluate` and marks in `reduce` never puts its benchmarks where a submission
 * could read them.
 *
 * ## What this package does not know
 *
 * What a case is. `plan` returns a list and each element comes back untouched,
 * so a competition's instances, seeds or datasets are its own business and can
 * be described however the organiser likes. Files listed in `include:` are
 * copied in and never parsed, which is how a `cases.yaml` in the project reaches
 * the program without this package having heard of it.
 */

const LOGS = "open-competition-kit/tag/logs";

/** Keep the log to something a page can render and a row can hold. */
const LOG_LINES = 512;

/**
 * The settings for one competition's runner, or nothing when it configured
 * none.
 *
 * A competition with no `program:` is not this package's to run, and saying so
 * by returning nothing is what lets the hook fall through to whatever else is
 * installed. Core validated this block at boot against the same schema, so a
 * failure here means the config changed underneath a running process.
 */
const settings = async (
  competition: string,
): Promise<ScriptRunner | undefined> => {
  const c = await unsafe(sdk.competitions.get(competition));
  const read = script.safeParse(c.runner ?? {});
  if (!read.success) {
    throw new Error(
      `The runner: block on ${competition} is not one this package can read: ` +
        read.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
    );
  }
  return read.data.program ? read.data : undefined;
};

/**
 * The image to evaluate in, built when the config describes one.
 *
 * `sandbox.build` is idempotent and cheap once the image exists, so this is safe
 * per job as well as at startup, and it has to be both: an organiser who edits a
 * recipe should get the new image on the next submission rather than the next
 * restart, and a host whose images were pruned should recover on its own.
 */
const image = async (runner: ScriptRunner): Promise<string> => {
  if (runner.build) {
    const built = await unsafe(sandbox.build(runner.build));
    return built.image;
  }
  if (!runner.image) {
    throw new Error("This runner has neither an image: nor a build: to run in.");
  }
  return runner.image;
};

/** The organiser's files, at the paths the shim expects them. */
const payload = (runner: ScriptRunner, request: Request) => {
  const files: Record<string, Uint8Array | string> = {
    [SHIM]: shim,
    [PROGRAM]: runner.program ?? "",
    [REQUEST]: JSON.stringify(request),
  };
  for (const [path, body] of Object.entries(runner.include ?? {})) {
    files[`${WORK}/${path.replace(/^\/+/, "")}`] = body;
  }
  return files;
};

/**
 * Run one phase and read the reply off standard output.
 *
 * Standard error is the log and standard output is the answer, and the shim is
 * the only thing that can write to the second. An empty standard output means
 * the container died before replying, which is the case worth naming: it is what
 * a timeout, an OOM kill and an image with no `python3` all look like from here.
 */
const invoke = async (
  runner: ScriptRunner,
  built: string,
  request: Request,
  submission?: Readonly<Record<string, Uint8Array>>,
): Promise<{ value: unknown; log: string }> => {
  // The paths go into the request as well as into the container, because a
  // program is handed a `Submission` and not a directory to go looking through.
  // It is the difference between `submission.copy_into("/runner")` and every
  // program writing its own directory walk, and the walk would find whatever
  // else happened to be under that path.
  const described: Request =
    submission ?
      {
        ...request,
        submission: { root: SUBMISSION, files: Object.keys(submission) },
      }
    : request;

  const files = payload(runner, described);
  for (const [path, body] of Object.entries(submission ?? {})) {
    files[`${SUBMISSION}/${path.replace(/^\/+/, "")}`] = body;
  }

  const result = await unsafe(
    sandbox.run({
      image: built,
      command: ["python3", SHIM],
      files,
      cwd: WORK,
      timeoutMs: runner.timeoutMs,
      limits: runner.limits,
    }),
  );

  const log = result.stderr.trim();
  const where = `${request.phase}${request.case === undefined ? "" : " of a case"}`;

  if (!result.stdout.trim()) {
    throw new Error(
      result.timedOut ?
        `The ${where} phase ran out of time after ${runner.timeoutMs ?? "the default"}ms.`
      : `The ${where} phase exited with ${result.code} and said nothing. ` +
        `That is what running out of memory looks like, and what an image ` +
        `without python3 looks like. Its output was:\n${log}`,
    );
  }

  let reply: Reply;
  try {
    reply = JSON.parse(result.stdout) as Reply;
  } catch {
    throw new Error(
      `The ${where} phase did not reply with JSON. Its output was:\n${result.stdout.slice(0, 2000)}`,
    );
  }

  if (!reply.ok) {
    throw new Error(`The ${where} phase raised:\n${reply.error}`);
  }

  return { value: reply.value, log };
};

/** Append to the job's log, keeping the tail. */
const record = async (job: string, lines: readonly string[]) => {
  const wanted = lines.filter(Boolean);
  if (!wanted.length) return;
  const previous = await unsafe(outputs.get({ reference: LOGS, owner: job }));
  const next = (Array.isArray(previous) ? [...previous, ...wanted] : wanted).slice(
    -LOG_LINES,
  );
  await unsafe(outputs.set({ reference: LOGS, owner: job, value: next }));
};

/** The competition a job belongs to. */
const competitionOf = async (job: string) => {
  const entry = await unsafe(jobs.get(job));
  const submission = await unsafe(submissions.get(entry.submission));
  const track = await unsafe(tracks.get(submission.track));
  return track.competition;
};

const evaluate = async (job: string, runner: ScriptRunner) => {
  const built = await image(runner);

  const base = {
    protocol: PROTOCOL,
    job,
    params: (runner.params ?? {}) as Record<string, unknown>,
  };

  const plan = await invoke(runner, built, { ...base, phase: "plan" as Phase });
  const cases = Array.isArray(plan.value) ? plan.value : [null];
  await record(job, [
    plan.log,
    `Planned ${cases.length} case${cases.length === 1 ? "" : "s"}.`,
  ]);

  const files = await source.files(job, { allow: runner.submission?.allow });

  const results: Record<string, Scalar>[] = [];
  for (const [index, item] of cases.entries()) {
    const label = `case ${index + 1}/${cases.length}`;
    try {
      const outcome = await invoke(
        runner,
        built,
        { ...base, phase: "evaluate", case: item },
        files,
      );
      const flat = row(outcome.value, `evaluate() on ${label}`);
      results.push(flat);
      // Written as each case finishes rather than at the end, so a competitor
      // watching a long evaluation sees it move. It is also the only progress
      // there is: a container reports nothing until it exits, and this is the
      // boundary between two of them.
      await record(job, [outcome.log, `${label}: ${JSON.stringify(flat)}`]);
    } catch (e) {
      // One case failing is one case scoring nothing. A suite that abandoned
      // forty cases because the third one crashed would report a total that
      // says far more about the crash than about the submission.
      const message = e instanceof Error ? e.message : String(e);
      results.push({});
      await record(job, [`${label} failed: ${message}`]);
    }
  }

  const reduced = await invoke(runner, built, {
    ...base,
    phase: "reduce",
    results,
    cases,
  });
  await record(job, [reduced.log]);

  return row(reduced.value, "reduce()");
};

export default {
  name: "@open-competition-kit/runner-script",
  description:
    "Evaluates submissions with a program the organiser inlines into the config, one case per container.",
  version: "0.0.10",
  config,
  runner: {
    /**
     * Build every competition's evaluation image before the first job arrives.
     *
     * Otherwise the first submission of the day waits out an `apt-get`, and a
     * recipe with a typo in it is discovered as somebody's failed evaluation
     * rather than as a service that would not start.
     *
     * Scoped to one competition, since that is how the runner service asks.
     */
    prepare: async ({ competition }, next) => {
      await next?.({ competition });

      const runner = await settings(competition);
      if (!runner?.build) return;

      console.log(`[runner-script] ${competition}: preparing the evaluation image`);
      const { image: tag, built } = await unsafe(sandbox.build(runner.build));
      console.log(
        `[runner-script] ${competition}: ${tag} ${built ? "built" : "already present"}`,
      );
    },
    run: async ({ job }, next) => {
      const competition = await competitionOf(job);
      const runner = await settings(competition);

      // Not ours. Hand it to whatever else is installed rather than failing the
      // job, so a deployment can run a program for one competition and a package
      // for another.
      if (!runner) {
        return (await next?.({ job })) ?? { status: "skipped" };
      }

      await unsafe(jobs.update({ id: job, status: "running" }));

      try {
        const value = await evaluate(job, runner);
        await unsafe(
          outputs.set({ reference: reference.std.output, owner: job, value }),
        );
        await unsafe(jobs.update({ id: job, status: "done" }));
        return { status: "done" };
      } catch (e) {
        // The job's failure, not the runner's. Letting it escape would stop
        // every job queued behind this one.
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[runner-script] job ${job} failed:`, e);
        await record(job, [message]).catch(() => undefined);
        await unsafe(jobs.update({ id: job, status: "error" }));
        return { status: "error" };
      }
    },
  },
} satisfies Package;
