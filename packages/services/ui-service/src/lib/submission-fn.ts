import { skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk, {
  context,
  competitions,
  jobs,
  submissions,
  tracks,
  unsafe,
} from "@open-competition-kit/sdk";
import {
  listUserSubmissions,
  type UserSubmissionSummary,
} from "./competition-data";
import { z } from "zod";
import { ensureAuthSession } from "./auth.server";
import { resolveId } from "./configure-user";

const competitionSubmissionsInput = z.object({
  userId: z.string(),
  competitionId: z.string(),
});

const userSubmissionsInput = z.string();

const submissionDetailInput = z.object({
  userId: z.string(),
  submissionId: z.string(),
});

export type SubmissionBrowserItem = UserSubmissionSummary;

export type SubmissionDetail = SubmissionBrowserItem & {
  jobs: Array<{
    id: string;
    status: string;
    logs: string;
    outputs: Array<{
      id: string;
      job: string;
      value: string;
      reference: string;
    }>;
  }>;
};

const getCompetitionSubmissions = createServerFn({ method: "GET" })
  .inputValidator(competitionSubmissionsInput)
  .handler(async ({ data }) => {
    const submissions = await listUserSubmissions(data.userId);
    return submissions.filter(
      (submission) => submission.competitionId === data.competitionId,
    );
  });

const getUserSubmissions = createServerFn({ method: "GET" })
  .inputValidator(userSubmissionsInput)
  .handler(async ({ data: userId }) => {
    return listUserSubmissions(userId);
  });

const getSubmissionDetail = createServerFn({ method: "GET" })
  .inputValidator(submissionDetailInput)
  .handler(async ({ data }): Promise<SubmissionDetail> => {
    const submission = await unsafe(submissions.get(data.submissionId));

    if (submission.user !== data.userId) {
      throw new Error("Unauthorized");
    }

    const [track, submissionJobs] = await Promise.all([
      unsafe(tracks.get(submission.track)),
      unsafe(jobs.list({ submission: submission.id })),
    ]);
    const submissionCompetition = await unsafe(
      competitions.get(track.competition),
    );

    const jobsWithOutputs = await Promise.all(
      submissionJobs.map(async (job) => {
        const outputContexts = await unsafe(
          context.list({
            owner: job.id,
            namespace: "open-competition-kit/namespace/job/output",
          }),
        );
        return {
          id: job.id,
          status: job.status,
          outputs: outputContexts.map((output) => ({
            id: output.id,
            job: output.owner,
            value: String(output.value ?? ""),
            reference: output.reference,
          })),
          logs: "Logs are not available in the current runner implementation yet.",
        };
      }),
    );

    return {
      id: submission.id,
      body: submission.body,
      trackId: track.id,
      trackName: track.name ?? track.id,
      competitionId: submissionCompetition.id,
      competitionName: submissionCompetition.name ?? submissionCompetition.id,
      jobs: jobsWithOutputs,
    };
  });

export function useCompetitionSubmissions(
  userId?: string,
  competitionId?: string,
) {
  const getCompetitionSubmissionsFn = useServerFn(getCompetitionSubmissions);
  return useQuery({
    queryKey: ["competitionSubmissions", userId, competitionId],
    queryFn:
      userId && competitionId ?
        () => getCompetitionSubmissionsFn({ data: { userId, competitionId } })
      : skipToken,
  });
}

export function useUserSubmissions(userId?: string) {
  const getUserSubmissionsFn = useServerFn(getUserSubmissions);
  return useQuery({
    queryKey: ["userSubmissions", userId],
    queryFn: userId ? () => getUserSubmissionsFn({ data: userId }) : skipToken,
  });
}

export function useSubmissionDetail(userId?: string, submissionId?: string) {
  const getSubmissionDetailFn = useServerFn(getSubmissionDetail);
  return useQuery({
    queryKey: ["submissionDetail", userId, submissionId],
    refetchInterval: 1000,
    queryFn:
      userId && submissionId ?
        () =>
          getSubmissionDetailFn({
            data: { userId, submissionId },
          }) as Promise<SubmissionDetail>
      : skipToken,
  });
}

const submissionInput = z.object({
  trackId: z.string(),
  value: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
});

export const createSubmission = createServerFn({ method: "POST" })
  .inputValidator(submissionInput)
  .handler(async ({ data }) => {
    const session = await ensureAuthSession();
    const enrolmentStatus = await sdk.enrolments.isEnrolled(
      resolveId(session.user),
      data.trackId,
    );
    if (enrolmentStatus.error) throw enrolmentStatus.error;
    if (!enrolmentStatus.value) {
      throw new Error("You must enrol in this track before submitting.");
    }

    const result = await sdk.submissions.submit(
      resolveId(session.user),
      JSON.stringify(data.value),
      data.trackId,
    );

    if (result.error) throw result.error;

    return { success: true, submission: result.value.submission };
  });
