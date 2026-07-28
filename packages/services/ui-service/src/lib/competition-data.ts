import { startCase } from "es-toolkit";
import {
  competitions,
  enrolments,
  submissions,
  tracks,
  unsafe,
} from "@open-competition-kit/sdk";

export type TrackSummary = {
  id: string;
  name: string;
  description: string;
  overview: string;
  rules: string;
  competitionId: string;
};

export type CompetitionSummary = {
  id: string;
  name: string;
  organiser: string;
  description: string;
  overview: string;
  rules: string;
  tracks: TrackSummary[];
};

export type SubmissionSummary = { id: string; body: string };

export type UserSubmissionSummary = SubmissionSummary & {
  trackId: string;
  trackName: string;
  competitionId: string;
  competitionName: string;
};

export type EnrolmentSummary = {
  id: string;
  track: TrackSummary;
  competition: CompetitionSummary;
  submissions: SubmissionSummary[];
};

function makeCompetitionDescription(name: string, trackCount: number) {
  if (trackCount === 0) return "No description yet.";
  if (trackCount === 1) return `${name} currently has 1 track available.`;
  return `${name} currently has ${trackCount} tracks available.`;
}

export async function getCompetitionSummary(
  id: string,
): Promise<CompetitionSummary> {
  const competition = await unsafe(competitions.get(id));

  const competitionTracks = await unsafe(tracks.of(competition));

  const competitionName = competition?.name ?? startCase(id);
  const trackSummaries: TrackSummary[] = competitionTracks.map((track) => ({
    id: track.id,
    name: track.name ?? startCase(track.id),
    description: track.description ?? "No description",
    overview: track.overview ?? "",
    rules: track.rules ?? "",
    competitionId: id,
  }));

  return {
    ...competition,
    id,
    name: competitionName,
    organiser: competition.organiser || "OpenCompetitionKit",
    description:
      competition.description ||
      makeCompetitionDescription(competitionName, trackSummaries.length),
    overview: competition.overview ?? "",
    rules: competition.rules ?? "",
    tracks: trackSummaries,
  };
}

export async function listCompetitionSummaries(): Promise<
  CompetitionSummary[]
> {
  const competitionRecords = await unsafe(competitions.list({}));
  return Promise.all(
    competitionRecords.map((competition) =>
      getCompetitionSummary(competition.id),
    ),
  );
}

export async function getTrackSummary(trackId: string) {
  const track = await unsafe(tracks.get(trackId));
  const competition = await getCompetitionSummary(track.competition);
  return competition.tracks.find((candidate) => candidate.id === trackId);
}

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
        submissions: userSubmissions
          .filter((submission) => submission.track === enrolment.track)
          .map((submission) => ({ id: submission.id, body: submission.body })),
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
