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
import { authMiddleware } from "./auth-server";
import { resolveId } from "./configure-user";

const competitionSubmissionsInput = z.object({
  competitionId: z.string(),
});

const submissionDetailInput = z.object({
  submissionId: z.string(),
});

export type SubmissionBrowserItem = UserSubmissionSummary;

// A serialisable JSON value: a job output may be any of these, not just a string.
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SubmissionDetail = SubmissionBrowserItem & {
  jobs: Array<{
    id: string;
    status: string;
    logs: string;
    outputs: Array<{
      id: string;
      job: string;
      // A JSON value: string, number, boolean, null, object, or array.
      value: JsonValue;
      reference: string;
    }>;
  }>;
};

/**
 * Every one of these reads is scoped to the caller, so the user id comes from
 * the session rather than the request body. The kit keys users by `resolveId`,
 * not by better-auth's `session.user.id`, so a client-supplied id matched no
 * rows; it also let a caller read another entrant's submissions by naming them.
 */
const getCompetitionSubmissions = createServerFn({ method: "GET" })
  .inputValidator(competitionSubmissionsInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }) => {
    const submissions = await listUserSubmissions(resolveId(session.user));
    return submissions.filter(
      (submission) => submission.competitionId === data.competitionId,
    );
  });

const getUserSubmissions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context: { session } }) =>
    listUserSubmissions(resolveId(session.user)),
  );

const getSubmissionDetail = createServerFn({ method: "GET" })
  .inputValidator(submissionDetailInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }): Promise<SubmissionDetail> => {
    const submission = await unsafe(submissions.get(data.submissionId));

    if (submission.user !== resolveId(session.user)) {
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
            value: (output.value ?? null) as JsonValue,
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

/**
 * `sessionUserId` never reaches the server. It separates one signed-in user's
 * cached submissions from the next's, and holds each query back until the
 * session has loaded.
 */
export function useCompetitionSubmissions(
  sessionUserId?: string,
  competitionId?: string,
) {
  const getCompetitionSubmissionsFn = useServerFn(getCompetitionSubmissions);
  return useQuery({
    queryKey: ["competitionSubmissions", sessionUserId, competitionId],
    queryFn:
      sessionUserId && competitionId
        ? () => getCompetitionSubmissionsFn({ data: { competitionId } })
        : skipToken,
  });
}

export function useUserSubmissions(sessionUserId?: string) {
  const getUserSubmissionsFn = useServerFn(getUserSubmissions);
  return useQuery({
    queryKey: ["userSubmissions", sessionUserId],
    queryFn: sessionUserId ? () => getUserSubmissionsFn() : skipToken,
  });
}

export function useSubmissionDetail(
  sessionUserId?: string,
  submissionId?: string,
) {
  const getSubmissionDetailFn = useServerFn(getSubmissionDetail);
  return useQuery({
    queryKey: ["submissionDetail", sessionUserId, submissionId],
    refetchInterval: 1000,
    queryFn:
      sessionUserId && submissionId
        ? () =>
            getSubmissionDetailFn({
              data: { submissionId },
            }) as Promise<SubmissionDetail>
        : skipToken,
  });
}

// A form value is any JSON value, not just a scalar: a `kind: file` field's value
// is a `FileRef` object.
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

const submissionInput = z.object({
  trackId: z.string(),
  value: z.record(z.string(), jsonValue),
});

export const createSubmission = createServerFn({ method: "POST" })
  .inputValidator(submissionInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }) => {
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
