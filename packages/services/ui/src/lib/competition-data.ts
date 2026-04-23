import { startCase } from "es-toolkit";
import { competitions, enrolments, submissions, tracks, unsafe } from "sdk";

export type TrackSummary = {
  id: string;
  name: string;
  description: string;
  competitionId: string;
};

export type CompetitionSummary = {
  id: string;
  name: string;
  organizer: string;
  description: string;
  tracks: TrackSummary[];
};

export type SubmissionSummary = {
  id: string;
  body: string;
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

function makeTrackDescription(trackName: string, competitionName: string) {
  return `${trackName} track in ${competitionName}.`;
}

export async function getCompetitionSummary(
  id: string,
): Promise<CompetitionSummary> {
  const competition = await unsafe(competitions.get(id));
  const competitionTracks = await unsafe(tracks.of(competition));

  const competitionName = competition?.name ?? startCase(id);
  const trackSummaries: TrackSummary[] = competitionTracks.map((track) => ({
    id: track.id,
    name: track.name,
    description: makeTrackDescription(track.name, competitionName),
    competitionId: id,
  }));

  return {
    id,
    name: competitionName,
    organizer: "OpenCompetitionKit",
    description: makeCompetitionDescription(
      competitionName,
      trackSummaries.length,
    ),
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

export async function getTrackSummary(competitionId: string, trackId: string) {
  const competition = await getCompetitionSummary(competitionId);
  return competition.tracks.find((track) => track.id === trackId);
}

export async function isEnrolledInTrack(userId: string, trackId: string) {
  const matchingEnrolments = await unsafe(
    enrolments.list({ user: userId, track: trackId }),
  );
  return matchingEnrolments.length > 0;
}

export async function listUserEnrolments(
  userId: string,
): Promise<EnrolmentSummary[]> {
  const [userEnrolments, userSubmissions, allCompetitions] = await Promise.all([
    unsafe(enrolments.list({ user: userId })),
    unsafe(submissions.list({ user: userId })),
    listCompetitionSummaries(),
  ]);

  return userEnrolments.map((enrolment) => {
    const competition =
      allCompetitions.find((competition) =>
        competition.tracks.some((track) => track.id === enrolment.track),
      ) ??
      ({
        id: "",
        name: "Competition",
        organizer: "OpenCompetitionKit",
        description: "No description yet.",
        tracks: [],
      } satisfies CompetitionSummary);

    const track =
      competition.tracks.find((track) => track.id === enrolment.track) ??
      ({
        id: enrolment.track,
        name: startCase(enrolment.track),
        description: "No description yet.",
        competitionId: competition.id,
      } satisfies TrackSummary);

    return {
      id: enrolment.id,
      track,
      competition: {
        ...competition,
        tracks: competition.tracks.length ? competition.tracks : [track],
      },
      submissions: userSubmissions
        .filter((submission) => submission.track === enrolment.track)
        .map((submission) => ({
          id: submission.id,
          body: submission.body,
        })),
    };
  });
}
