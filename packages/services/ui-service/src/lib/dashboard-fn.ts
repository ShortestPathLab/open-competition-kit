/**
 * What the organiser dashboard asks the server for.
 *
 * Every handler here opens with `ensureAdmin`. A `createServerFn` is a public
 * HTTP endpoint that anyone can call by hand, so the route guard on `/dashboard`
 * decides what renders and nothing more: the check that actually keeps entrants'
 * names and submission bodies from strangers is the one in each handler.
 */
import { skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk, {
  context,
  jobs,
  reference,
  submissions,
  tracks,
  unsafe,
  users,
} from "@open-competition-kit/sdk";
import { z } from "zod";
import { ensureAdmin } from "./admin";
import { readCompetitionActivity, type CompetitionActivity } from "./dashboard-data";
import type { JobOutput, JsonValue, SubmissionJob } from "./submission-fn";

const JOB_OUTPUT_NAMESPACE = "open-competition-kit/namespace/job/output";
const LOGS_REFERENCE = `${reference.stem}/logs`;

/** One competition an organiser may switch to, for the header's picker. */
export type DashboardCompetition = {
  id: string;
  name: string;
  /** Only ever set for a draft, which the picker marks so it is not mistaken for live. */
  visibility?: string;
};

const listDashboardCompetitions = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardCompetition[]> => {
    await ensureAdmin();
    const config = await unsafe(sdk.config.get());
    return config.competitions.map((competition) => ({
      id: competition.id,
      name: competition.name ?? competition.id,
      visibility: competition.visibility,
    }));
  },
);

const getCompetitionActivity = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: competitionId }): Promise<CompetitionActivity> => {
    await ensureAdmin();
    return readCompetitionActivity(competitionId);
  });

/**
 * One entrant's whole history in one competition.
 *
 * Derived from the same activity read rather than queried on its own. A
 * participant page is opened from the list that already fetched it, so this
 * usually costs nothing beyond what react-query has cached.
 */
export type ParticipantDetail = {
  competitionId: string;
  competitionName: string;
  user: string;
  userName: string;
  tracks: { id: string; name: string; enrolledAt: string | null }[];
  submissions: CompetitionActivity["rows"];
  joinedAt: string | null;
};

const getParticipant = createServerFn({ method: "GET" })
  .inputValidator(z.object({ competitionId: z.string(), user: z.string() }))
  .handler(async ({ data }): Promise<ParticipantDetail | null> => {
    await ensureAdmin();

    const activity = await readCompetitionActivity(data.competitionId);
    const participant = activity.participants.find((entry) => entry.user === data.user);
    if (!participant) return null;

    return {
      competitionId: activity.id,
      competitionName: activity.name,
      user: participant.user,
      userName: participant.userName,
      tracks: participant.tracks,
      submissions: activity.rows.filter((row) => row.user === data.user),
      joinedAt: participant.joinedAt,
    };
  });

/** A submission as an organiser reads it: whose it is, and every run against it. */
export type AdminSubmissionDetail = {
  id: string;
  number: number;
  body: string;
  submittedAt: string | null;
  user: string;
  userName: string;
  trackId: string;
  trackName: string;
  competitionId: string;
  competitionName: string;
  jobs: SubmissionJob[];
};

/**
 * Log lines arrive either as an array or as one blob to be split, depending on
 * the runner. Same reading as the entrant's own submission page makes.
 */
function readLogLines(value: JsonValue | undefined): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split("\n");
  return [];
}

async function readJob(job: { id: string; status: string }): Promise<SubmissionJob> {
  const outputContexts = await unsafe(
    context.list({ owner: job.id, namespace: JOB_OUTPUT_NAMESPACE }),
  );

  const outputs: JobOutput[] = outputContexts.map((output) => ({
    id: output.id,
    job: output.owner,
    value: (output.value ?? null) as JsonValue,
    reference: output.reference,
  }));

  return {
    id: job.id,
    status: job.status,
    result: outputs.find((output) => output.reference === reference.std.output)?.value ?? null,
    logs: readLogLines(outputs.find((output) => output.reference === LOGS_REFERENCE)?.value),
    outputs: outputs.filter(
      (output) => output.reference !== reference.std.output && output.reference !== LOGS_REFERENCE,
    ),
  };
}

const getAdminSubmission = createServerFn({ method: "GET" })
  .inputValidator(z.object({ competitionId: z.string(), submissionId: z.string() }))
  .handler(async ({ data }): Promise<AdminSubmissionDetail | null> => {
    await ensureAdmin();

    const submission = await unsafe(submissions.get(data.submissionId)).catch(() => undefined);
    if (!submission) return null;

    const track = await unsafe(tracks.get(submission.track)).catch(() => undefined);
    // A submission belonging to another competition is as absent from this one
    // as one that never existed, so the id in the URL cannot be used to read
    // across competitions.
    if (!track || track.competition !== data.competitionId) return null;

    const [competition, submissionJobs, trackSubmissions, user] = await Promise.all([
      unsafe(sdk.competitions.get(track.competition)),
      unsafe(jobs.list({ submission: submission.id })),
      unsafe(submissions.list({ track: submission.track })),
      unsafe(users.get(submission.user)).catch(() => undefined),
    ]);

    return {
      id: submission.id,
      number:
        trackSubmissions
          .filter((entry) => entry.user === submission.user)
          .findIndex((entry) => entry.id === submission.id) + 1,
      body: submission.body,
      submittedAt: submission.createdAt ? new Date(submission.createdAt).toISOString() : null,
      user: submission.user,
      userName: user?.name || submission.user,
      trackId: track.id,
      trackName: track.name ?? track.id,
      competitionId: competition.id,
      competitionName: competition.name ?? competition.id,
      jobs: await Promise.all(submissionJobs.map(readJob)),
    };
  });

/**
 * Score this submission again, without a new submission.
 *
 * The organiser's version of the button an entrant has on their own submission.
 * It exists here because the reason to use it is usually the organiser's: a
 * runner that was misconfigured when the deadline passed, or a batch of jobs
 * that died on a machine that has since been fixed.
 */
const rerunAdminSubmission = createServerFn({ method: "POST" })
  .inputValidator(z.object({ competitionId: z.string(), submissionId: z.string() }))
  .handler(async ({ data }) => {
    await ensureAdmin();

    const submission = await unsafe(submissions.get(data.submissionId));
    const track = await unsafe(tracks.get(submission.track));
    if (track.competition !== data.competitionId) {
      throw new Error("That submission does not belong to this competition.");
    }

    return unsafe(sdk.jobs.createFromSubmission(submission.id));
  });

export function useDashboardCompetitions() {
  const listFn = useServerFn(listDashboardCompetitions);
  return useQuery({
    queryKey: ["dashboardCompetitions"],
    queryFn: () => listFn(),
  });
}

export function useCompetitionActivity(competitionId?: string) {
  const getActivity = useServerFn(getCompetitionActivity);
  return useQuery({
    queryKey: ["competitionActivity", competitionId],
    queryFn: competitionId
      ? () => getActivity({ data: competitionId }) as Promise<CompetitionActivity>
      : skipToken,
  });
}

export function useParticipant(competitionId?: string, user?: string) {
  const getParticipantFn = useServerFn(getParticipant);
  return useQuery({
    queryKey: ["dashboardParticipant", competitionId, user],
    queryFn:
      competitionId && user
        ? () =>
            getParticipantFn({ data: { competitionId, user } }) as Promise<ParticipantDetail | null>
        : skipToken,
  });
}

export function useAdminSubmission(competitionId?: string, submissionId?: string) {
  const getSubmission = useServerFn(getAdminSubmission);
  return useQuery({
    queryKey: ["dashboardSubmission", competitionId, submissionId],
    // A run in progress settles on its own, so the page follows it rather than
    // asking the reader to reload.
    refetchInterval: 2000,
    queryFn:
      competitionId && submissionId
        ? () =>
            getSubmission({
              data: { competitionId, submissionId },
            }) as Promise<AdminSubmissionDetail | null>
        : skipToken,
  });
}

export { rerunAdminSubmission };
