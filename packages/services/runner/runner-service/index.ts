import { jobs, type Job, unsafe } from "@open-competition-kit/sdk";
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

export async function startBasicRunner() {
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
