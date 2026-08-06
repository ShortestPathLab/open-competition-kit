import {
  config,
  DEFAULT_STALE_CLAIM_MS,
  hooks,
  jobs,
  JobStatus,
  lifecycle,
  type Job,
  unsafe,
} from "@open-competition-kit/sdk";
import { stat } from "node:fs/promises";
import { createConfigWatch } from "./config-watch";
import { DEFAULT_IDLE_TOLERANCE_MS, reportOn, serveHealth } from "./health";
import { createPollingWorker } from "./polling";
import { concurrencyFrom, mapWithLimit, settleStatus } from "./queue";

const IDLE_TOLERANCE_MS = (() => {
  const raw = process.env.OCK_RUNNER_IDLE_TOLERANCE_MS;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_IDLE_TOLERANCE_MS;
})();

const CONCURRENCY = concurrencyFrom(process.env.OCK_RUNNER_CONCURRENCY);

/**
 * How long before a claim is treated as abandoned, and how often to look.
 *
 * The sweep is a backstop for a process that died holding a job, so it runs on
 * its own slow timer rather than in the job poll: there is nothing to gain from
 * asking every two seconds about a condition that only arises when a service
 * crashes.
 */
const STALE_CLAIM_MS = (() => {
  const raw = process.env.OCK_RUNNER_STALE_CLAIM_MS;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_CLAIM_MS;
})();

const SWEEP_POLL_MS = 60_000;

/**
 * How often to look at the config file.
 *
 * Slower than the job poll on purpose. A config change is a thing a person did
 * seconds ago and is willing to wait a moment for, and this runs for the life of
 * the service.
 */
const CONFIG_POLL_MS = 5000;

async function getRunnableJobs() {
  return unsafe(jobs.list({ status: JobStatus.pending })) as Promise<readonly Job[]>;
}

/**
 * One job, from taking it to leaving it in a state nothing has to guess about.
 *
 * The claim is the whole point. Listing pending jobs and running them is what
 * this used to do, and two runner services against one database both saw the
 * same rows: every submission was evaluated twice, scored twice, and whichever
 * write landed second won. `jobs.claim` moves the row from pending to running
 * under a guard, so exactly one caller is told to proceed.
 *
 * What is left afterwards matters as much. A runner that answers writes its own
 * terminal status and clears the claim. A runner that passes, or one that threw
 * before it could say anything, leaves the row claimed by a process that is not
 * going to come back to it, so the outcome is written here instead.
 */
async function processRunnableJob(job: Job) {
  const mine = await unsafe(jobs.claim(job.id, new Date().toISOString()));
  if (!mine) return;

  try {
    const outcome = await unsafe(jobs.run(job.id));
    const current = (await unsafe(jobs.get(job.id))) as Job;
    const settled = settleStatus(current.status, outcome, JobStatus.running, JobStatus.skipped);
    if (settled === undefined) return;

    await unsafe(jobs.release(job.id, settled));
    if (settled === JobStatus.skipped) {
      console.warn(
        `[runner-service] job ${job.id} was not claimed by any runner. ` +
          `Check that a runner package is installed and configured for its competition.`,
      );
    }
  } catch (error) {
    // The job failed, not the service. Marked rather than left holding a claim,
    // or it sits as `running` until the stale sweep gets to it an hour later.
    console.error(`[runner-service] job ${job.id} failed`, error);
    await unsafe(jobs.release(job.id, JobStatus.error)).catch(() => undefined);
  }
}

export async function pollAndProcessSubmissions() {
  const runnableJobs = await getRunnableJobs();

  if (runnableJobs.length === 0) return;

  await mapWithLimit(runnableJobs, CONCURRENCY, processRunnableJob);
}

/**
 * Put back the jobs whose runner died holding them.
 *
 * Nothing else will: a row that says `running` is invisible to the pending
 * query, so a process killed mid-evaluation strands that submission with no
 * result and no error, and the competitor is never told. The guard on the write
 * is the claim stamp this read, so a live runner cannot have its job taken.
 */
export async function sweepStaleClaims() {
  const before = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const reclaimed = await unsafe(jobs.sweepStaleClaims(before));
  if (reclaimed.length > 0) {
    console.warn(
      `[runner-service] returned ${reclaimed.length} job(s) to the queue whose claim ` +
        `was older than ${STALE_CLAIM_MS}ms: ${reclaimed.join(", ")}`,
    );
  }
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

  // Stamped when a poll finishes rather than when one starts, so the gap the
  // health check reads is "how long since this loop last got all the way round"
  // and not "how long since it last tried".
  let lastPollAt = Date.now();

  const worker = createPollingWorker({
    intervalMs: 2000,
    poll: async () => {
      try {
        await pollAndProcessSubmissions();
      } finally {
        // In `finally`, because a poll that threw still went round. Counting only
        // successful polls would report a runner failing every cycle against an
        // unreachable database as stalled, which is true of the database and not
        // of the loop, and the log already says which.
        lastPollAt = Date.now();
      }
    },
    onError(error) {
      console.error("runner-service poll failed", error);
    },
  });

  worker.start();

  const health = serveHealth(() =>
    reportOn(Date.now() - lastPollAt, worker.busy(), IDLE_TOLERANCE_MS),
  );

  const sweeper = createPollingWorker({
    intervalMs: SWEEP_POLL_MS,
    poll: sweepStaleClaims,
    onError(error) {
      console.error("runner-service could not sweep stale claims", error);
    },
  });

  sweeper.start();

  const watcher = await watchConfigFile(worker);

  const stop = () => {
    worker.stop();
    sweeper.stop();
    watcher?.stop();
    health?.stop();
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(
    `runner-service started, up to ${CONCURRENCY} evaluation(s) at once ` +
      `(OCK_RUNNER_CONCURRENCY)` +
      (health ? `, health on :${health.port}/health` : ", no health endpoint"),
  );
}

await startBasicRunner();
