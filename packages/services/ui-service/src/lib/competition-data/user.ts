import { enrolments, submissions, unsafe } from "@open-competition-kit/sdk";
import { listCompetitionSummaries } from "./summaries";
import type { EnrolmentSummary, UserSubmissionSummary } from "./types";

export async function listUserEnrolments(
  userId: string,
): Promise<EnrolmentSummary[]> {
  const [userEnrolments, userSubmissions, allCompetitions] = await Promise.all([
    unsafe(enrolments.list({ user: userId })),
    unsafe(submissions.list({ user: userId })),
    listCompetitionSummaries(),
  ]);

  return userEnrolments.flatMap((enrolment) => {
    const competition = allCompetitions.find((competition) =>
      competition.tracks.some((track) => track.id === enrolment.track),
    );

    const track = competition?.tracks.find(
      (track) => track.id === enrolment.track,
    );

    // An enrolment outlives its track. Tracks come from the competition config,
    // so dropping one there leaves rows behind that point at nothing. Skip those
    // rather than letting one stale row throw away the whole list.
    if (!competition || !track) return [];

    return [
      {
        id: enrolment.id,
        track,
        competition,
        // `submissions.list` answers in creation order, so position in this
        // filtered array is the attempt number.
        submissions: userSubmissions
          .filter((submission) => submission.track === enrolment.track)
          .map((submission, index) => ({
            id: submission.id,
            body: submission.body,
            number: index + 1,
          })),
      },
    ];
  });
}

export async function listUserSubmissions(
  userId: string,
): Promise<UserSubmissionSummary[]> {
  const enrolments = await listUserEnrolments(userId);
  return enrolments.flatMap((enrolment) =>
    enrolment.submissions.map((submission) => ({
      ...submission,
      trackId: enrolment.track.id,
      trackName: enrolment.track.name,
      competitionId: enrolment.competition.id,
      competitionName: enrolment.competition.name,
    })),
  );
}
