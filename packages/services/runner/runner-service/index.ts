import {
  config,
  hooks,
  jobs,
  type Job,
  unsafe,
} from "@open-competition-kit/sdk";
import { createPollingWorker } from "./polling";

const DEFAULT_PENDING_STATUS = "pending";

async function getRunnableJobs() {
  return unsafe(jobs.list({ status: DEFAULT_PENDING_STATUS })) as Promise<
    readonly Job[]
  >;
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

  process.on("SIGINT", () => worker.stop());
  process.on("SIGTERM", () => worker.stop());

  console.log("runner-service started");
}

await startBasicRunner();
