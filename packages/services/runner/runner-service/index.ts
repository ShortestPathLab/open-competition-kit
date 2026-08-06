import { config, hooks, jobs, lifecycle, type Job, unsafe } from "@open-competition-kit/sdk";
import { stat } from "node:fs/promises";
import { createConfigWatch } from "./config-watch";
import { createPollingWorker } from "./polling";

const DEFAULT_PENDING_STATUS = "pending";

/**
 * How often to look at the config file.
 *
 * Slower than the job poll on purpose. A config change is a thing a person did
 * seconds ago and is willing to wait a moment for, and this runs for the life of
 * the service.
 */
const CONFIG_POLL_MS = 5000;

async function getRunnableJobs() {
  return unsafe(jobs.list({ status: DEFAULT_PENDING_STATUS })) as Promise<readonly Job[]>;
}

async function processRunnableJob(job: Job) {
  await unsafe(jobs.run(job.id));
}

export async function pollAndProcessSubmissions() {
  const runnableJobs = await getRunnableJobs();

  if (runnableJobs.length === 0) return;

  await Promise.all(runnableJobs.map(processRunnableJob));
}

/**
 * Give every competition's runner a chance to get ready before any job arrives.
 *
 * Building an evaluation image is what this is for. Left until the first
 * submission, an `apt-get` and a `git clone` happen while somebody waits, and a
 * recipe with a mistake in it surfaces as a failed evaluation rather than as a
 * service that would not start.
 *
 * Asked per competition so each is resolved through its own `with:` list. A
 * deployment can run a program for one competition and a package for another,
 * and neither has to know the other exists.
 *
 * A competition that cannot prepare does not stop the service. The others are
 * still runnable, and a runner whose image is missing fails its own jobs with a
 * message about the image, which beats a stack that will not come up at all.
 */
export async function prepareRunners() {
  const c = await unsafe(config.get());

  for (const competition of c.competitions) {
    try {
      await unsafe(
        hooks.do((h) => h.runner.prepare({ competition: competition.id }), {
          competitions: competition.id,
        }),
      );
    } catch (error) {
      console.error(`runner-service could not prepare ${competition.id}`, error);
    }
  }
}

/** Enough to tell one version of a file from the next, and cheap to ask for. */
async function stampOf(path: string) {
  try {
    const info = await stat(path);
    return `${info.mtimeMs}:${info.size}`;
  } catch {
    return undefined;
  }
}

/**
 * Watch the config file, and stand down when it changes.
 *
 * Only started where standing down means coming back. A runner started by hand
 * in a terminal has nothing to restart it, so it says once that it will keep
 * running against the config it read and leaves it there, rather than exiting
 * and taking the evaluations with it.
 */
async function watchConfigFile(worker: ReturnType<typeof createPollingWorker>) {
  const support = await unsafe(lifecycle.support());

  if (!support.restartable) {
    console.log(`runner-service will not restart itself on a config change. ${support.detail}`);
    return;
  }

  const path = await unsafe(config.path());

  const watcher = createPollingWorker({
    intervalMs: CONFIG_POLL_MS,
    poll: createConfigWatch({
      stamp: () => stampOf(path),
      busy: () => worker.busy(),
      drain: () => worker.stop(),
      restart: () => unsafe(lifecycle.restart()),
    }),
    onError(error) {
      console.error("runner-service could not check the config file", error);
    },
  });

  watcher.start();
  return watcher;
}

export async function startBasicRunner() {
  await prepareRunners();

  const worker = createPollingWorker({
    intervalMs: 2000,
    poll: pollAndProcessSubmissions,
    onError(error) {
      console.error("runner-service poll failed", error);
    },
  });

  worker.start();

  const watcher = await watchConfigFile(worker);

  const stop = () => {
    worker.stop();
    watcher?.stop();
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log("runner-service started");
}

await startBasicRunner();
