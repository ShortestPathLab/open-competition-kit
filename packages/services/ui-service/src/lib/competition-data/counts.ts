import { enrolments, submissions, unsafe } from "@open-competition-kit/sdk";
import { getCompetitionSummary } from "./summaries";
import { ensureTrackAvailable } from "./visibility";

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
