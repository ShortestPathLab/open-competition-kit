/**
 * One competition, read the way an organiser looks at it.
 *
 * The three dashboard pages ask the same question from different ends. The
 * overview wants totals, the participants page wants it grouped by person, and
 * the submissions page wants it flat and sorted by time. Answering all three
 * from one read keeps them agreeing about how many submissions there are, and
 * costs the database four queries plus one per track rather than one per
 * submission: jobs and results are fetched in bulk and indexed here, which is
 * the difference between a page that opens and a page that opens eventually.
 *
 * Server-only. Every caller is behind `ensureAdmin`, and the rows carry entrants'
 * names and bodies, which nobody else may read.
 */
import {
  context,
  enrolments,
  jobs,
  namespace,
  reference,
  submissions,
  tracks,
  unsafe,
  users,
} from "@open-competition-kit/sdk";
import { groupBy } from "es-toolkit";
import { requireVisibleCompetition } from "./competition-data/visibility";
import type { JsonValue } from "./submission-fn";

const JOB_OUTPUT_NAMESPACE = `${namespace.stem}/job/output` as const;

/** One submission, with what its newest run made of it. */
export type ActivityRow = {
  id: string;
  /** Which attempt at this track it was for this entrant, counting from one. */
  number: number;
  /** The kit's id for the entrant, which is their email. */
  user: string;
  /** Their display name, or their id when they never set one. */
  userName: string;
  trackId: string;
  trackName: string;
  body: string;
  submittedAt: string | null;
  runs: number;
  /** The newest run's status. Absent when nothing has run. */
  status?: string;
  /** What the newest run wrote under the default output reference. */
  result: JsonValue | null;
};

/** One entrant, and everything they have done in this competition. */
export type ParticipantRow = {
  user: string;
  userName: string;
  /** Tracks they entered, whether or not they have submitted to any of them. */
  tracks: { id: string; name: string; enrolledAt: string | null }[];
  submissions: number;
  runs: number;
  /** When they last submitted. Absent for somebody who has only enrolled. */
  lastSubmittedAt: string | null;
  /** When they first entered a track here. */
  joinedAt: string | null;
};

export type CompetitionActivity = {
  id: string;
  name: string;
  tracks: { id: string; name: string }[];
  rows: ActivityRow[];
  participants: ParticipantRow[];
  totals: {
    participants: number;
    enrolments: number;
    submissions: number;
    /** Runs that finished, whatever the runner called finishing. */
    evaluated: number;
    running: number;
    failed: number;
  };
};

const FAILED = new Set(["failed", "error", "errored", "failure", "cancelled", "canceled"]);
const RUNNING = new Set(["pending", "queued", "waiting", "running", "started"]);

const isoOf = (value: unknown) =>
  value instanceof Date
    ? value.toISOString()
    : typeof value === "string" && value
      ? new Date(value).toISOString()
      : null;

/** Newest first, with the undated sorted last rather than first. */
const byNewest = (a: string | null, b: string | null) =>
  a && b ? b.localeCompare(a) : a ? -1 : b ? 1 : 0;

/**
 * Everything the dashboard shows about one competition.
 *
 * The visibility check is the same one the public pages go through. An organiser
 * is allowed to see a draft, and `requireVisibleCompetition` already knows that,
 * so a second rule here would be a second chance to get it wrong.
 */
export async function readCompetitionActivity(competitionId: string): Promise<CompetitionActivity> {
  const competition = await requireVisibleCompetition(competitionId);
  const competitionTracks = await unsafe(tracks.of(competition));

  const trackList = competitionTracks.map((track) => ({
    id: track.id,
    name: track.name ?? track.id,
  }));
  const trackNames = new Map(trackList.map((track) => [track.id, track.name]));

  // Jobs, results and names come back whole and get indexed below. Asking per
  // submission is the same data in a few hundred round trips.
  const [competitionEnrolments, perTrack, allJobs, allResults, allUsers] = await Promise.all([
    unsafe(enrolments.list({ competition: competitionId })),
    Promise.all(trackList.map((track) => unsafe(submissions.list({ track: track.id })))),
    unsafe(jobs.list({})),
    unsafe(
      context.list({ namespace: JOB_OUTPUT_NAMESPACE, reference: reference.std.output }),
    ),
    unsafe(users.list({})),
  ]);

  const names = new Map(allUsers.map((user) => [user.id, user.name || user.id]));
  const resultOf = new Map(allResults.map((output) => [output.owner, output.value as JsonValue]));
  const jobsBySubmission = groupBy(allJobs, (job) => job.submission);

  const rows: ActivityRow[] = [];
  let evaluated = 0;
  let running = 0;
  let failed = 0;

  for (const [index, trackSubmissions] of perTrack.entries()) {
    const track = trackList[index];
    // Attempt numbers are per entrant per track, which is the unit the gates
    // count in, so "submission 3" here means the same 3 an attempt quota does.
    const attempts = new Map<string, number>();

    for (const submission of trackSubmissions) {
      const attempt = (attempts.get(submission.user) ?? 0) + 1;
      attempts.set(submission.user, attempt);

      const submissionJobs = jobsBySubmission[submission.id] ?? [];
      const newest = submissionJobs.at(-1);
      const status = newest?.status;

      if (status) {
        if (FAILED.has(status.toLowerCase())) failed++;
        else if (RUNNING.has(status.toLowerCase())) running++;
        else evaluated++;
      }

      rows.push({
        id: submission.id,
        number: attempt,
        user: submission.user,
        userName: names.get(submission.user) ?? submission.user,
        trackId: track.id,
        trackName: track.name,
        body: submission.body,
        submittedAt: isoOf(submission.createdAt),
        runs: submissionJobs.length,
        status,
        result: newest ? (resultOf.get(newest.id) ?? null) : null,
      });
    }
  }

  rows.sort((a, b) => byNewest(a.submittedAt, b.submittedAt));

  const participants = new Map<string, ParticipantRow>();

  const participantOf = (user: string) => {
    const existing = participants.get(user);
    if (existing) return existing;
    const created: ParticipantRow = {
      user,
      userName: names.get(user) ?? user,
      tracks: [],
      submissions: 0,
      runs: 0,
      lastSubmittedAt: null,
      joinedAt: null,
    };
    participants.set(user, created);
    return created;
  };

  for (const enrolment of competitionEnrolments) {
    // An enrolment outlives its track: tracks come from the config, so removing
    // one there leaves rows pointing at nothing. Those are dropped rather than
    // shown as a track with no name.
    if (!trackNames.has(enrolment.track)) continue;

    const participant = participantOf(enrolment.user);
    const enrolledAt = isoOf(enrolment.createdAt);

    participant.tracks.push({
      id: enrolment.track,
      name: trackNames.get(enrolment.track) ?? enrolment.track,
      enrolledAt,
    });

    if (enrolledAt && (!participant.joinedAt || enrolledAt < participant.joinedAt)) {
      participant.joinedAt = enrolledAt;
    }
  }

  for (const row of rows) {
    // Somebody can submit to a track they were enrolled in before the enrolment
    // row was cleaned up, so a submission is enough to put them on this list.
    const participant = participantOf(row.user);
    participant.submissions++;
    participant.runs += row.runs;
    if (byNewest(row.submittedAt, participant.lastSubmittedAt) < 0) {
      participant.lastSubmittedAt = row.submittedAt;
    }
  }

  const participantList = [...participants.values()].sort(
    (a, b) =>
      byNewest(a.lastSubmittedAt, b.lastSubmittedAt) || a.userName.localeCompare(b.userName),
  );

  return {
    id: competitionId,
    name: competition.name ?? competitionId,
    tracks: trackList,
    rows,
    participants: participantList,
    totals: {
      participants: participantList.length,
      enrolments: competitionEnrolments.length,
      submissions: rows.length,
      evaluated,
      running,
      failed,
    },
  };
}
