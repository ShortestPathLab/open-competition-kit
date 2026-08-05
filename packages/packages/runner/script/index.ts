import sdk, {
  jobs,
  machine,
  outputs,
  reference,
  source,
  submissions,
  tracks,
  unsafe,
  type Package,
} from "@open-competition-kit/sdk";
import { config, script, type ScriptRunner } from "./config";
import {
  PROTOCOL,
  REPLY,
  REQUEST,
  SUBMISSION,
  WORK,
  type Phase,
  type Reply,
  type Request,
} from "./protocol";
import { ONE_UNNAMED_CASE, row, sumOf, type Scalar } from "./row";

/**
 * Evaluating a competition with a program instead of a package.
 *
 * The organiser writes a program and a command that runs it. This package runs
 * that command three times, each as a run of its own: once to plan, once per
 * case, and once to reduce the results into the row a leaderboard reads. Each
 * run finds a JSON request at a fixed path and leaves a JSON reply at the path
 * that request names.
 *
 * Where those runs happen is the machine's business rather than this package's.
 * With `machine-docker` installed each one is a container. With no machine
 * package installed each one is a child process of the runner service, and the
 * paragraph below about blast radius describes only the first of those.
 *
 * ## Why there is no shim
 *
 * Because two files is already the smallest interface, and anything friendlier
 * has to be written once per language. A shim that loads a module and maps named
 * arguments onto parameters is worth maybe fifteen lines to the organiser, and
 * costs a per-language adapter that has to be kept in step with the protocol,
 * shipped, versioned, and matched to whatever a competition's image happens to
 * have installed. Reading a file is something every language already does.
 *
 * What that buys: this package contains no language, no interpreter name and no
 * extension. A Python script, a Go binary, a shell script and a language nobody
 * has heard of are the same thing from here.
 *
 * ## Why a run per case rather than one for the whole evaluation
 *
 * Because the alternative gives one submission the run of its own evaluation.
 * Case three exhausting its memory would take cases four through forty with it,
 * a wedged interpreter would strand the lot, and the wall-clock limit would have
 * to be generous enough for the entire suite, which makes it barely a limit.
 * Fanning out costs a start per case and buys a blast radius of one.
 *
 * The plan and reduce runs have no submission anywhere near them, which keeps
 * the scoring step out of reach of the code being scored. A program that
 * measures when it evaluates and marks when it reduces never puts its benchmarks
 * where a submission could read them.
 *
 * ## What this package does not know
 *
 * What a case is. The plan phase answers with a list and each element comes back
 * untouched, so a competition's instances, seeds or datasets are its own
 * business and can be described however the organiser likes. Files listed in
 * `include:` are copied in and never parsed, which is how a `cases.yaml` in the
 * project reaches the program without this package having heard of it.
 */

const LOGS = "open-competition-kit/tag/logs";

/** Keep the log to something a page can render and a row can hold. */
const LOG_LINES = 512;

/**
 * The settings for one competition's runner, or nothing when it configured
 * none.
 *
 * A competition with no `command:` is not this package's to run, and saying so
 * by returning nothing is what lets the hook fall through to whatever else is
 * installed. Core validated this block at boot against the same schema, so a
 * failure here means the config changed underneath a running process.
 */
const settings = async (competition: string): Promise<ScriptRunner | undefined> => {
  const c = await unsafe(sdk.competitions.get(competition));
  const read = script.safeParse(c.runner ?? {});
  if (!read.success) {
    throw new Error(
      `The runner: block on ${competition} is not one this package can read: ` +
        read.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  return read.data.command ? read.data : undefined;
};

/**
 * The image to evaluate in, built when the config describes one.
 *
 * `machine.build` is idempotent and cheap once the image exists, so this is safe
 * per job as well as at startup, and it has to be both: an organiser who edits a
 * recipe should get the new image on the next submission rather than the next
 * restart, and a host whose images were pruned should recover on its own.
 *
 * Nothing is a valid answer. A runner with neither an image: nor a build: is one
 * whose command runs wherever the machine puts it, which is what the local
 * machine does and the only way to evaluate anything without a Docker socket.
 * Whether that is a mistake depends on the machine, so the machine is what says
 * so: this package cannot tell a missing image from one that was never needed.
 */
const image = async (runner: ScriptRunner): Promise<string | undefined> => {
  if (runner.build) {
    const built = await unsafe(machine.build(runner.build));
    return built.image;
  }
  return runner.image;
};

/** Everything the command needs on disk, at the paths the request names. */
const payload = (runner: ScriptRunner, request: Request) => {
  const files: Record<string, Uint8Array | string> = {
    [REQUEST]: JSON.stringify(request),
  };
  for (const [path, body] of Object.entries(runner.include ?? {})) {
    files[`${WORK}/${path.replace(/^\/+/, "")}`] = body;
  }
  return files;
};

/**
 * Run one phase and read the reply back out.
 *
 * Both streams are the log and the answer arrives as a file, so a program is
 * free to print whatever its harness printed without any of it being mistaken
 * for a result. No reply file means the program never got to write one, which is
 * the case worth naming: a wall-clock kill, an OOM kill and a machine whose
 * interpreter is not there all look like this from here.
 */
const invoke = async (
  runner: ScriptRunner,
  built: string | undefined,
  // Without `reply`, which is filled in below: a caller should not have to
  // repeat a path the protocol already fixes.
  request: Omit<Request, "reply">,
  submission?: Readonly<Record<string, Uint8Array>>,
): Promise<{ value: unknown; log: string }> => {
  // The submission's paths go into the request as well as onto the disk, so a
  // program is handed a list rather than a directory to go walking. A walk would
  // find whatever else happened to be under that path, and would have to be
  // written again in every language anybody evaluates in.
  const described: Request = {
    ...request,
    reply: REPLY,
    ...(submission
      ? {
          submission: { root: SUBMISSION, files: Object.keys(submission) },
        }
      : {}),
  };

  const files = payload(runner, described);
  for (const [path, body] of Object.entries(submission ?? {})) {
    files[`${SUBMISSION}/${path.replace(/^\/+/, "")}`] = body;
  }

  const result = await unsafe(
    machine.run({
      image: built,
      command: runner.command ?? [],
      files,
      cwd: WORK,
      collect: [REPLY],
      timeoutMs: runner.timeoutMs,
      limits: runner.limits,
    }),
  );

  const log = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const where = `${request.phase}${request.case === undefined ? "" : " of a case"}`;

  const written = result.files[REPLY];
  if (!written?.length) {
    // The common failure now that no shim catches anything: a program that threw
    // never reached its own write. Its output is in the log, and the log is the
    // traceback, so the message points there rather than trying to guess.
    throw new Error(
      result.timedOut
        ? `The ${where} phase ran out of time after ${runner.timeoutMs ?? "the default"}ms.`
        : `The ${where} phase exited with ${result.code} and left no reply at ` +
            `${REPLY}. A program that fails before it writes one looks like this, ` +
            `and so does a machine with no ${runner.command?.[0] ?? "command"} on ` +
            `it. Its output was:\n${log}`,
    );
  }

  let reply: Reply;
  try {
    reply = JSON.parse(new TextDecoder().decode(written)) as Reply;
  } catch {
    throw new Error(
      `The ${where} phase did not write JSON to ${REPLY}. It wrote:\n` +
        new TextDecoder().decode(written.slice(0, 2000)),
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
  const next = (Array.isArray(previous) ? [...previous, ...wanted] : wanted).slice(-LOG_LINES);
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
  if (plan.value != null && !Array.isArray(plan.value)) {
    throw new Error(
      `The plan phase answered with ${typeof plan.value}. It has to answer with ` +
        `a list of cases, or with null to say there is one unnamed case.`,
    );
  }
  const cases = plan.value ?? ONE_UNNAMED_CASE;
  await record(job, [plan.log, `Planned ${cases.length} case${cases.length === 1 ? "" : "s"}.`]);

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
      // there is: a run reports nothing until it exits, and this is the
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

  // `null` means the program has no opinion about how its cases add up, so the
  // host applies its own. A competition that only scores one thing therefore
  // never writes a reduce it does not have an opinion about.
  if (reduced.value == null) return sumOf(results);

  return row(reduced.value, "reduce()");
};

export default {
  name: "@open-competition-kit/runner-script",
  description:
    "Evaluates submissions with a program the organiser inlines into the config, one case per run.",
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
      const { image: tag, built } = await unsafe(machine.build(runner.build));
      console.log(`[runner-script] ${competition}: ${tag} ${built ? "built" : "already present"}`);
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
        await unsafe(outputs.set({ reference: reference.std.output, owner: job, value }));
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
