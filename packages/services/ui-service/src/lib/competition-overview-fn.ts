import { authClient } from "./auth-client";
import type { TrackSummary } from "./competition-data";
import {
  useCompetition,
  useCompetitionEnrolmentCount,
  useCompetitionSubmissionCount,
} from "./competition-fn";
import { useUserEnrolments } from "./enrolment-fn";
import { useTracksWithReports } from "./gate-fn";
import { useCompetitionLeaderboards, useCompetitionStandings } from "./leaderboard-fn";
import { useCompetitionSubmissions } from "./submission-fn";

/** Stable identity, so an absent competition does not rebuild the query key. */
const NO_TRACKS: TrackSummary[] = [];

/**
 * Everything the competition's front page reads, in one call.
 *
 * Eight queries, none of which depends on another, so they are all in flight at
 * once and the page paints each panel as its own answer lands. Gathered here
 * rather than in the route because the page is a layout: what it needs and how
 * it arranges what it got are two different jobs, and only one of them changes
 * when a panel moves.
 */
export function useCompetitionOverview(id: string) {
  const { data: competition } = useCompetition(id);
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const userId = session?.user?.id;

  const { data: mySubmissions = [], isLoading: submissionsLoading } = useCompetitionSubmissions(
    userId,
    id,
  );
  const { data: myEnrolments = [], isLoading: enrolmentsLoading } = useUserEnrolments(userId);
  const { data: leaderboards } = useCompetitionLeaderboards(id);
  const { data: submissionCount } = useCompetitionSubmissionCount(id);
  const { data: enrolmentCount } = useCompetitionEnrolmentCount(id);
  const { data: standings, isPending: standingsLoading } = useCompetitionStandings(id, userId);
  // An absent competition asks about no tracks, which the query skips entirely.
  const tracksWithReports = useTracksWithReports(competition?.tracks ?? NO_TRACKS, userId);

  return {
    competition,
    leaderboards,
    submissionCount,
    enrolmentCount,
    standings,
    standingsLoading,
    tracksWithReports,
    isSignedIn: !!session?.user,
    userName: session?.user?.name,
    enrolledTrackIds: myEnrolments
      .filter((enrolment) => enrolment.competition.id === id)
      .map((enrolment) => enrolment.track.id),
    mySubmissionCount: mySubmissions.length,
    /**
     * The reader's own panel waits on the session before it waits on anything
     * else: until that lands there is no user to have submissions or enrolments,
     * and the two queries below are skipped rather than pending.
     */
    myLoading: sessionLoading || (!!userId && (submissionsLoading || enrolmentsLoading)),
  };
}

export type CompetitionOverview = ReturnType<typeof useCompetitionOverview>;
