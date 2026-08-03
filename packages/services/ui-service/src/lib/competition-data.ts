import { startCase } from "es-toolkit";
import {
  competitions,
  enrolments,
  submissions,
  tracks,
  unsafe,
} from "@open-competition-kit/sdk";
import { isVisibleTo } from "@open-competition-kit/sdk/visibility";
import { adminStatus } from "./admin";

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
  /**
   * Only ever `"draft"` for an organiser, since nobody else is handed a draft in
   * the first place. It exists so their pages can say so.
   */
  visibility?: string;
};

export type SubmissionSummary = {
  id: string;
  body: string;
  /**
   * Which attempt at this track it was, counting from one.
   *
   * The id is a cuid, which tells a competitor nothing and is unpleasant to say
   * out loud. Numbering runs per track because that is the unit a competitor is
   * given: the gates a package enforces are counted per track, so "submission 3"
   * is the same 3 an attempt quota is talking about.
   */
  number: number;
};

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

/**
 * A draft is missing rather than forbidden, for the same reason the route guard
 * says so: "forbidden" tells a stranger the competition exists.
 *
 * This lives here rather than only in the guard because every one of these
 * summaries is reachable through a `createServerFn`, and a server function is a
 * public HTTP endpoint whether or not a route ever renders it.
 */
class CompetitionNotFoundError extends Error {
  constructor(id: string) {
    super(`Competition "${id}" not found.`);
  }
}

export async function getCompetitionSummary(
  id: string,
): Promise<CompetitionSummary> {
  const [competition, admin] = await Promise.all([
    unsafe(competitions.get(id)),
    adminStatus(),
  ]);

  if (!isVisibleTo(competition, admin.isAdmin)) {
    throw new CompetitionNotFoundError(id);
  }

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
  const [competitionRecords, admin] = await Promise.all([
    unsafe(competitions.list({})),
    adminStatus(),
  ]);
  // Filtered before the summaries are built, not after: `getCompetitionSummary`
  // throws on a draft, so mapping the unfiltered list would reject the whole
  // index the moment one competition went unpublished.
  return Promise.all(
    competitionRecords
      .filter((competition) => isVisibleTo(competition, admin.isAdmin))
      .map((competition) => getCompetitionSummary(competition.id)),
  );
}

/**
 * Guards a write against the track's competition being published.
 *
 * Reading a draft is already impossible for anyone but an organiser, but enrolling
 * and submitting do not go through any of the read paths — they take a track id
 * and act on it. Without this, a track id leaked or guessed while a competition
 * was still being drafted would still accept entrants.
 */
export async function ensureTrackAvailable(trackId: string): Promise<void> {
  const track = await unsafe(tracks.get(trackId));
  const [competition, admin] = await Promise.all([
    unsafe(competitions.get(track.competition)),
    adminStatus(),
  ]);

  if (!isVisibleTo(competition, admin.isAdmin)) {
    throw new CompetitionNotFoundError(track.competition);
  }
}

/**
 * How many submissions a competition has taken, across all of its tracks.
 *
 * A whole-competition figure, not the caller's own: it sits in the public stat
 * strip next to the track and leaderboard counts, and those describe the
 * competition rather than whoever happens to be reading. Counted track by track
 * because a submission records the track it went to and nothing above it.
 */
export async function countCompetitionSubmissions(competitionId: string) {
  const competition = await getCompetitionSummary(competitionId);
  const perTrack = await Promise.all(
    competition.tracks.map((track) =>
      unsafe(submissions.list({ track: track.id })),
    ),
  );
  return perTrack.reduce((total, trackSubmissions) => {
    return total + trackSubmissions.length;
  }, 0);
}

/**
 * How many enrolments a competition holds, across all of its tracks.
 *
 * Rows rather than people: somebody who entered three tracks counts three
 * times, which is what the word on the label means and what an organiser
 * counting entries is after. Unlike a submission, an enrolment records the
 * competition it belongs to, so this is one query instead of one per track.
 *
 * Routed through `getCompetitionSummary` for its visibility check, so a draft
 * cannot leak its size through a count that skipped the guard.
 */
export async function countCompetitionEnrolments(competitionId: string) {
  await getCompetitionSummary(competitionId);
  const competitionEnrolments = await unsafe(
    enrolments.list({ competition: competitionId }),
  );
  return competitionEnrolments.length;
}

/**
 * How many submissions one track has taken, across everybody who entered it.
 *
 * The competition-wide figure sums these, but a track page cannot be served from
 * that sum, and asking for the whole competition to read one of its parts means
 * a query per sibling track for a number the page never shows.
 */
export async function countTrackSubmissions(trackId: string) {
  await ensureTrackAvailable(trackId);
  const trackSubmissions = await unsafe(submissions.list({ track: trackId }));
  return trackSubmissions.length;
}

/**
 * How many entrants a track holds.
 *
 * Behind `ensureTrackAvailable` for the same reason the competition counts go
 * through `getCompetitionSummary`: a server function is a public HTTP endpoint,
 * and a draft that leaks the size of its field has still leaked.
 */
export async function countTrackEnrolments(trackId: string) {
  await ensureTrackAvailable(trackId);
  const trackEnrolments = await unsafe(enrolments.list({ track: trackId }));
  return trackEnrolments.length;
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
