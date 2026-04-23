import { differenceWith, flatMap, keyBy, mapAsync } from "es-toolkit";
import {
  config,
  type CompetitionConfigShape,
  jobs,
  outputs,
  submissions,
  type Job,
  type Output,
  type Submission,
} from "sdk";
import { unsafe } from "sdk";
import { createPollingWorker } from "./polling";

type ConfiguredTrackRunner = {
  trackId: string;
  track: CompetitionConfigShape["tracks"][number];
  competition: CompetitionConfigShape;
  body?: string;
};

const DEFAULT_REFERENCE = "default";
const DEFAULT_PENDING_STATUS = "pending";
const DEFAULT_RUNNING_STATUS = "running";
const DEFAULT_COMPLETED_STATUS = "completed";
const DEFAULT_FAILED_STATUS = "failed";

const sameSubmission = (
  submission: { id: string },
  output: { submission: string },
) => submission.id === output.submission;

function stringifyResult(result: unknown) {
  return JSON.stringify(result ?? null);
}

function evaluateRunnerBody(
  body: string,
  context: {
    submission: Submission;
    competition: CompetitionConfigShape;
    track: CompetitionConfigShape["tracks"][number];
  },
) {
  const { submission, competition, track } = context;
  return eval(body);
}

async function getConfiguredTrackRunners() {
  const appConfig = await unsafe(config.get());
  const competitions = appConfig.competitions;

  return keyBy(
    flatMap(competitions, (competition: CompetitionConfigShape) =>
      competition.tracks.map((track: CompetitionConfigShape["tracks"][number]) => ({
        trackId: track.id,
        track,
        competition,
        body: competition.runner.body,
      }) satisfies ConfiguredTrackRunner),
    ),
    ({ trackId }: { trackId: string }) => trackId,
  ) as Record<string, ConfiguredTrackRunner>;
}

async function getPendingSubmissions() {
  const [submissionRecords, jobRecords] = await Promise.all([
    unsafe(submissions.list({})) as Promise<readonly Submission[]>,
    unsafe(jobs.list({})) as Promise<readonly Job[]>,
  ]);

  return differenceWith(
    submissionRecords,
    jobRecords.map((job) => ({ submission: job.submission })),
    sameSubmission,
  );
}

async function createMissingJobsForSubmissions() {
  const pendingSubmissions = await getPendingSubmissions();

  if (pendingSubmissions.length === 0) return;

  await mapAsync(pendingSubmissions, (submission: Submission) =>
    unsafe(
      jobs.create({
        submission: submission.id,
        status: DEFAULT_PENDING_STATUS,
      }),
    ),
  );
}

async function getRunnableJobs() {
  const [jobRecords, outputRecords] = await Promise.all([
    unsafe(jobs.list({ status: DEFAULT_PENDING_STATUS })) as Promise<
      readonly Job[]
    >,
    unsafe(outputs.list({ reference: DEFAULT_REFERENCE })) as Promise<
      readonly Output[]
    >,
  ]);

  return differenceWith(
    jobRecords,
    outputRecords.map((output) => ({ id: output.job })),
    (job: { id: string }, output: { id: string }) => job.id === output.id,
  );
}

async function processJob(
  job: Job,
  submission: Submission,
  configuredTrackRunners: Awaited<ReturnType<typeof getConfiguredTrackRunners>>,
) {
  const configuredTrack = configuredTrackRunners[submission.track];

  if (!configuredTrack?.body) {
    await unsafe(
      jobs.update({
        id: job.id,
        submission: job.submission,
        status: DEFAULT_FAILED_STATUS,
      }),
    );
    console.warn(
      `Skipping submission ${submission.id}: no runner body configured for track ${submission.track}`,
    );
    return;
  }

  await unsafe(
    jobs.update({
      id: job.id,
      submission: job.submission,
      status: DEFAULT_RUNNING_STATUS,
    }),
  );

  const result = evaluateRunnerBody(configuredTrack.body, {
    submission,
    competition: configuredTrack.competition,
    track: configuredTrack.track,
  });

  await unsafe(
    outputs.create({
      job: job.id,
      result: stringifyResult(result),
      reference: DEFAULT_REFERENCE,
    }),
  );

  await unsafe(
    jobs.update({
      id: job.id,
      submission: job.submission,
      status: DEFAULT_COMPLETED_STATUS,
    }),
  );
}

async function processRunnableJob(
  job: Job,
  configuredTrackRunners: Awaited<ReturnType<typeof getConfiguredTrackRunners>>,
) {
  const submission = await unsafe(submissions.get(job.submission));

  try {
    await processJob(job, submission, configuredTrackRunners);
  } catch (error) {
    await unsafe(
      jobs.update({
        id: job.id,
        submission: job.submission,
        status: DEFAULT_FAILED_STATUS,
      }),
    );
    throw error;
  }
}

export async function pollAndProcessSubmissions() {
  await createMissingJobsForSubmissions();

  const [configuredTrackRunners, runnableJobs] = await Promise.all([
    getConfiguredTrackRunners(),
    getRunnableJobs(),
  ]);

  if (runnableJobs.length === 0) return;

  await mapAsync(runnableJobs, (job: Job) =>
    processRunnableJob(job, configuredTrackRunners),
  );
}

export async function startBasicRunner() {
  const worker = createPollingWorker({
    intervalMs: 2000,
    poll: pollAndProcessSubmissions,
    onError(error) {
      console.error("basic-runner poll failed", error);
    },
  });

  worker.start();

  process.on("SIGINT", () => worker.stop());
  process.on("SIGTERM", () => worker.stop());

  console.log("basic-runner started");
}

await startBasicRunner();
