/**
 * Running a command on the machine the runner service is already on.
 *
 * The one you get when nothing else is installed. It starts the command as an
 * ordinary child process, at the paths the caller asked for, and hands back what
 * it printed. There is no image, no container and no confinement worth the name:
 * whatever the runner service can reach, so can the command, and by extension so
 * can a submission being evaluated by it.
 *
 * That is the trade, and it is worth having in exchange for an evaluation you can
 * run on the afternoon you write it. An organiser trying a scoring program out
 * should not have to stand up a Docker socket first. An organiser with
 * competitors should install `@open-competition-kit/machine-docker` and get a
 * container per run, which is the same evaluation with the parts that matter.
 *
 * ## What it does not do
 *
 * Memory, CPU and process caps are ignored, because a child process cannot be
 * held to them without cgroups and a package that pretended otherwise would be
 * worse than one that says so. `network: false` is ignored for the same reason.
 * A submission that forks endlessly takes the host with it, and one that phones
 * home succeeds.
 *
 * The wall-clock limit is real, and is the one thing here that does protect the
 * queue: a program that hangs is killed, and the job after it still runs.
 *
 * ## Why the paths are taken literally
 *
 * The caller passes absolute paths, and a program written against them opens
 * `/ock/request.json` by that name. Nothing here can relocate that: the paths
 * also travel inside the request as data, so a machine that quietly moved them
 * would move half of them and leave a program reading a file that is no longer
 * where it was told. So this creates the directories it was given, and says so
 * plainly when it may not.
 */
import { mkdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type Limits = {
  memoryMb?: number;
  cpus?: number;
  pids?: number;
  network?: boolean;
  writable?: boolean;
};

export type Run = {
  image?: string;
  command: readonly string[];
  files?: Readonly<Record<string, Uint8Array | string>>;
  env?: Readonly<Record<string, string>>;
  cwd?: string;
  collect?: readonly string[];
  timeoutMs?: number;
  limits?: Limits;
};

export type Ran = {
  stdout: string;
  stderr: string;
  code: number;
  timedOut: boolean;
  elapsedMs: number;
  files: Readonly<Record<string, Uint8Array>>;
};

/**
 * Said once, at the first run rather than at startup.
 *
 * A deployment that never evaluates anything does not need telling, and one that
 * does gets told before the first submission is scored rather than in a line
 * that scrolled past hours earlier.
 */
let warned = false;
const warnOnce = () => {
  if (warned) return;
  warned = true;
  console.warn(
    "[machine-local] Evaluations are running as child processes of this " +
      "service, with the same access it has and no memory, process or network " +
      "limit. That is what you get when no other machine is installed, and it " +
      "is fine while you are the only one submitting. Install " +
      "@open-competition-kit/machine-docker before anybody else is.",
  );
};

const exists = async (path: string) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * The highest directory at or above this one that is not there yet.
 *
 * What cleanup removes afterwards. Removing the leaf instead would leave `/ock`
 * behind on every run, and removing by name would eventually remove a directory
 * that was somebody else's before this process started.
 */
const topmostMissing = async (dir: string) => {
  let current = dir;
  let missing: string | undefined;
  while (current !== dirname(current)) {
    if (await exists(current)) break;
    missing = current;
    current = dirname(current);
  }
  return missing;
};

/** What one run put on the disk, and therefore what it has to take back off. */
type Placed = { created: Set<string>; written: string[] };

/**
 * Put the caller's files where it asked for them.
 *
 * Records what had to be created as it goes, in a ledger the caller owns, so
 * that a run which fails halfway still knows what it left behind. A failure is
 * reported against the path, since the usual cause is a process that may not
 * write there and the usual fix depends on which path it was.
 */
const place = async (
  files: Readonly<Record<string, Uint8Array | string>>,
  { created, written }: Placed,
) => {
  for (const [path, body] of Object.entries(files)) {
    const missing = await topmostMissing(dirname(path));
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body as Uint8Array | string);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Could not put "${path}" where the runner asked for it: ${message}. ` +
          `This machine writes to the paths it is given, on the host it is ` +
          `running on. Run the runner service somewhere it may create them, or ` +
          `install @open-competition-kit/machine-docker to get a container ` +
          `with its own filesystem.`,
        { cause: e },
      );
    }
    if (missing) created.add(missing);
    written.push(path);
  }
};

/**
 * The environment the command gets, which is not this process's.
 *
 * A submission shares whatever is running it, and this process was started with
 * a database URL, an admin address and whatever tokens the integrations needed.
 * Handing those to a stranger's code is the one failure here bad enough to be
 * worth spending a few lines to avoid, and PATH plus HOME is enough for an
 * interpreter to start.
 */
const environment = (asked: Readonly<Record<string, string>> | undefined) => ({
  PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
  HOME: process.env.HOME ?? "/tmp",
  LANG: process.env.LANG ?? "C.UTF-8",
  ...asked,
});

/**
 * One run at a time, whoever asks.
 *
 * The runner service starts every pending job at once, and every one of them
 * would write its request to the same absolute path. Two concurrent evaluations
 * on one machine means the second one's request lands on top of the first one's,
 * and both score whatever was left. Queuing them is slower and correct, and a
 * host that wants evaluations in parallel wants a machine that gives each of
 * them a filesystem.
 */
let queue: Promise<unknown> = Promise.resolve();
const oneAtATime = <T>(work: () => Promise<T>): Promise<T> => {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
};

const started = async (
  command: readonly string[],
  cwd: string | undefined,
  env: Record<string, string>,
) => {
  try {
    return Bun.spawn([...command], {
      cwd,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (e) {
    // A command that is not there fails here rather than with an exit code, and
    // the message Bun gives names a file that the organiser never wrote. This is
    // also the likeliest way to meet this machine's real limitation, so it is
    // worth the sentence.
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not start "${command.join(" ")}": ${message}. This machine runs ` +
        `commands on the host as they are, so whatever the command needs has ` +
        `to already be installed here. Install it, or install ` +
        `@open-competition-kit/machine-docker and give the runner an image: ` +
        `with it in.`,
      { cause: e },
    );
  }
};

/**
 * How long to keep reading a stream after the command has exited.
 *
 * Only ever spent when something outlived the command. Killing a process does
 * not kill what it started, and a helper left holding the other end of the pipe
 * keeps it open for as long as it feels like: waiting for the end of the stream
 * would mean a run killed at ninety seconds returning when the orphan finished,
 * which on the case that made us kill it is never.
 */
const DRAIN_MS = 500;

/**
 * Read a stream as it arrives, and be able to give up on it.
 *
 * Reading has to start before the command is waited on, because a program that
 * fills the pipe buffer blocks until somebody empties it, and a run that
 * deadlocks on its own log output would be a strange way to lose an evaluation.
 */
const sink = (stream: ReadableStream<Uint8Array>) => {
  const chunks: Uint8Array[] = [];
  const done = (async () => {
    for await (const chunk of stream) chunks.push(chunk);
  })().catch(() => undefined);
  return {
    done,
    text: () => chunks.map((c) => new TextDecoder().decode(c)).join(""),
  };
};

const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const collectFrom = async (paths: readonly string[]) => {
  const out: Record<string, Uint8Array> = {};
  for (const path of paths) {
    const file = Bun.file(path);
    if (!(await file.exists())) continue;
    out[path] = new Uint8Array(await file.arrayBuffer());
  }
  return out;
};

const forget = async (paths: Iterable<string>) => {
  for (const path of paths) {
    await rm(path, { recursive: true, force: true }).catch(() => undefined);
  }
};

const run = async (request: Run): Promise<Ran> => {
  warnOnce();

  if (request.image) {
    throw new Error(
      `This runner asks to be evaluated in "${request.image}", and no ` +
        `installed machine can start an image. Install ` +
        `@open-competition-kit/machine-docker, or take image: and build: out ` +
        `of the runner and let the command run on the host as it is.`,
    );
  }

  if (!request.command.length) {
    throw new Error("A run needs a command, and this one arrived with none.");
  }

  const startedAt = Date.now();

  // Declared out here and filled in below, so that the cleanup at the end runs
  // over whatever was placed rather than only over a complete set. A run that
  // could not write its third file has already written two.
  const placed: Placed = { created: new Set(), written: [] };

  try {
    await place(request.files ?? {}, placed);

    // Before the command starts, not only after it. A container gets a fresh
    // filesystem every time and this does not: a reply file left behind by the
    // case before would be read as this case's answer, and the score would be
    // wrong in the one way nothing downstream can detect.
    await forget(request.collect ?? []);

    // Recorded like any other directory this run had to invent. A command run
    // from a work directory that nothing was placed into still leaves one
    // behind, and a machine that tidies up after some of its runs is one whose
    // next failure is somebody wondering where a stale directory came from.
    if (request.cwd) {
      const missing = await topmostMissing(request.cwd);
      await mkdir(request.cwd, { recursive: true });
      if (missing) placed.created.add(missing);
    }

    const proc = await started(request.command, request.cwd, environment(request.env));

    // Our own timer rather than Bun's `timeout`, so that the answer to "was it
    // killed by the clock" is something we know rather than something inferred
    // from a signal that several other things also produce.
    let timedOut = false;
    const timer = request.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          proc.kill("SIGKILL");
        }, request.timeoutMs)
      : undefined;

    const out = sink(proc.stdout);
    const err = sink(proc.stderr);

    const code = await proc.exited;
    if (timer) clearTimeout(timer);

    // Killing the command does not kill anything the command started, and an
    // orphan holding the write end keeps both streams open behind it. So the
    // wait ends with the command, give or take whatever is still arriving. What
    // the orphan prints after that is lost, which is the better half of the
    // trade: the alternative is a killed job that never returns.
    await Promise.race([Promise.all([out.done, err.done]), after(DRAIN_MS)]);

    const files = await collectFrom(request.collect ?? []);

    return {
      stdout: out.text(),
      stderr: err.text(),
      code,
      timedOut,
      elapsedMs: Date.now() - startedAt,
      files,
    };
  } finally {
    // Directories this run created, then any file it wrote into a directory that
    // was already there. Nothing else, because everything else on this host
    // belongs to somebody.
    await forget(placed.created);
    for (const path of placed.written) {
      await unlink(path).catch(() => undefined);
    }
    await forget(request.collect ?? []);
  }
};

/**
 * Refusing to build, at the moment the recipe is read.
 *
 * The alternative is answering with a tag nothing will ever start, which turns
 * an organiser's Dockerfile into an evaluation that runs against whatever this
 * host happens to have installed and reports numbers for it. A competition
 * scored in the wrong image looks exactly like one scored in the right image,
 * which is why this is a refusal and not a warning.
 *
 * The runner service asks at startup, so an organiser who has written a recipe
 * and not installed a machine that can build it finds out then, rather than in
 * the first submission of the day.
 */
const build = async (): Promise<never> => {
  throw new Error(
    "This runner has a build: recipe and no installed machine can build one. " +
      "Install @open-competition-kit/machine-docker, or take build: out and " +
      "let the command run on the host with whatever is already installed.",
  );
};

export const local = {
  build,
  run: (request: Run) => oneAtATime(() => run(request)),
};
