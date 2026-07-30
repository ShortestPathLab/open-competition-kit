import { skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk, {
  context,
  competitions,
  jobs,
  reference,
  submissions,
  tracks,
  unsafe,
} from "@open-competition-kit/sdk";
import type { GateVerdict } from "@open-competition-kit/sdk/gate";
import {
  ensureTrackAvailable,
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

export type JobOutput = {
  id: string;
  job: string;
  // A JSON value: string, number, boolean, null, object, or array.
  value: JsonValue;
  reference: string;
};

export type SubmissionJob = {
  id: string;
  status: string;
  /**
   * The lines the runner logged, read off the `tag/logs` output rather than
   * invented here. Empty for a runner that writes none, which the page renders
   * as an empty state instead of a sentence claiming logs do not exist.
   */
  logs: string[];
  /**
   * The value under `reference.std.output`: whatever the runner wants ranked,
   * which is also what a leaderboard reads. `null` when the job wrote none, as
   * a failed job usually has.
   */
  result: JsonValue | null;
  /** Everything else the job wrote, minus the two references read above. */
  outputs: JobOutput[];
};

export type SubmissionDetail = SubmissionBrowserItem & {
  jobs: SubmissionJob[];
};

/** What a list row can say about a submission without opening it. */
export type SubmissionOutcome = {
  runs: number;
  /** The status of the newest job, absent when nothing has run. */
  status?: string;
  /** The newest job's result, so a row can show what the run produced. */
  result: JsonValue | null;
};

/**
 * The reference a runner writes its log lines to.
 *
 * `reference.std` names the default output and the submission source but not
 * this one, so the literal is spelled out here the same way the example
 * runner spells it. Worth promoting to `std` in the kit, at which point both
 * ends can stop writing it by hand.
 */
const LOGS_REFERENCE = `${reference.stem}/logs`;

/** Log values arrive as an array of lines, or as one blob to be split. */
function readLogLines(value: JsonValue | undefined): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split("\n");
  return [];
}

/**
 * One job, with the two references the UI reads pulled out of the pile.
 *
 * Every output lives in the same namespace and is told apart by its reference,
 * so the split has to happen somewhere. Here, rather than in the browser, keeps
 * the reference strings on the server that already imports them.
 */
async function readJob(job: { id: string; status: string }): Promise<SubmissionJob> {
  const outputContexts = await unsafe(
    context.list({
      owner: job.id,
      namespace: "open-competition-kit/namespace/job/output",
    }),
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
    result:
      outputs.find((output) => output.reference === reference.std.output)
        ?.value ?? null,
    logs: readLogLines(
      outputs.find((output) => output.reference === LOGS_REFERENCE)?.value,
    ),
    outputs: outputs.filter(
      (output) =>
        output.reference !== reference.std.output &&
        output.reference !== LOGS_REFERENCE,
    ),
  };
}

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
    const userId = resolveId(session.user);
    const submission = await unsafe(submissions.get(data.submissionId));

    if (submission.user !== userId) {
      throw new Error("Unauthorized");
    }

    // The whole track's attempts, only so this one can say which it was. The
    // page names it "Submission 3" and the list calls it the same thing, which
    // it will only keep doing while both count the same way: creation order,
    // within the track.
    const [track, submissionJobs, trackSubmissions] = await Promise.all([
      unsafe(tracks.get(submission.track)),
      unsafe(jobs.list({ submission: submission.id })),
      unsafe(submissions.list({ user: userId })),
    ]);
    const submissionCompetition = await unsafe(
      competitions.get(track.competition),
    );

    const jobsWithOutputs = await Promise.all(submissionJobs.map(readJob));

    return {
      id: submission.id,
      body: submission.body,
      number:
        trackSubmissions
          .filter((entry) => entry.track === submission.track)
          .findIndex((entry) => entry.id === submission.id) + 1,
      trackId: track.id,
      trackName: track.name ?? track.id,
      competitionId: submissionCompetition.id,
      competitionName: submissionCompetition.name ?? submissionCompetition.id,
      jobs: jobsWithOutputs,
    };
  });

/**
 * What each of the caller's submissions produced, keyed by submission id.
 *
 * Separate from the list itself, and fetched as its own query, because it costs
 * a job read and an output read per submission while the list costs one call.
 * The rows paint from the cheap query and fill in their result column when this
 * one lands, rather than the whole page waiting on the slowest part of it.
 */
const getUserSubmissionOutcomes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(
    async ({
      context: { session },
    }): Promise<Record<string, SubmissionOutcome>> => {
      const userSubmissions = await listUserSubmissions(
        resolveId(session.user),
      );

      const entries = await Promise.all(
        userSubmissions.map(async (submission) => {
          const submissionJobs = await unsafe(
            jobs.list({ submission: submission.id }),
          );
          const newest = submissionJobs.at(-1);

          return [
            submission.id,
            {
              runs: submissionJobs.length,
              status: newest?.status,
              result: newest ? (await readJob(newest)).result : null,
            },
          ] as const;
        }),
      );

      return Object.fromEntries(entries);
    },
  );

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

export function useUserSubmissionOutcomes(sessionUserId?: string) {
  const getUserSubmissionOutcomesFn = useServerFn(getUserSubmissionOutcomes);
  return useQuery({
    queryKey: ["userSubmissionOutcomes", sessionUserId],
    queryFn:
      sessionUserId
        ? () =>
            getUserSubmissionOutcomesFn() as Promise<
              Record<string, SubmissionOutcome>
            >
        : skipToken,
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

const gateInput = z.object({ trackId: z.string() });

/**
 * Why this competitor cannot submit to this track, asked before the form renders.
 *
 * Advisory. `createSubmission` runs the same chain through the kit, so a stale
 * answer here costs a confusing moment and nothing else. The user is taken from
 * the session rather than the request, since a caller who could name someone else
 * would be reading that person's attempt history out of the refusal details.
 */
export const getSubmissionGate = createServerFn({ method: "GET" })
  .inputValidator(gateInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }): Promise<GateVerdict> => {
    await ensureTrackAvailable(data.trackId);
    return unsafe(
      sdk.submissions.gate(resolveId(session.user), data.trackId),
    ) as Promise<GateVerdict>;
  });

export function useSubmissionGate(userId?: string, trackId?: string) {
  const getSubmissionGateFn = useServerFn(getSubmissionGate);
  return useQuery({
    queryKey: ["submissionGate", userId, trackId],
    // A window opens or a rate limit expires while the page is sitting there, so
    // the answer goes stale on its own without anybody touching anything.
    refetchInterval: 30_000,
    queryFn:
      userId && trackId ?
        () => getSubmissionGateFn({ data: { trackId } })
      : skipToken,
  });
}

export const createSubmission = createServerFn({ method: "POST" })
  .inputValidator(submissionInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }) => {
    await ensureTrackAvailable(data.trackId);

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
