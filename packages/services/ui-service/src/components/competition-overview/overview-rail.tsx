import { DeadlinePanel } from "@/components/deadline-panel";
import { StandingsPanel } from "@/components/standings-panel";
import { YourCompetitionPanel } from "@/components/your-competition-panel";
import type { CompetitionOverview } from "@/lib/competition-overview-fn";
import { LeaderboardsPanel } from "./leaderboards-panel";

type OverviewRailProps = Pick<
  CompetitionOverview,
  | "tracksWithReports"
  | "standings"
  | "standingsLoading"
  | "isSignedIn"
  | "userName"
  | "enrolledTrackIds"
  | "mySubmissionCount"
  | "myLoading"
  | "leaderboards"
> & { competitionId: string };

/**
 * Deadline, then standings, then you, then the leaderboards themselves.
 *
 * It runs from what is true of the competition to what is true of the reader,
 * and the deadline goes first because it is the only one that expires.
 */
export function OverviewRail({
  competitionId,
  tracksWithReports,
  standings,
  standingsLoading,
  isSignedIn,
  userName,
  enrolledTrackIds,
  mySubmissionCount,
  myLoading,
  leaderboards,
}: OverviewRailProps) {
  return (
    <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
      <DeadlinePanel tracks={tracksWithReports} />

      <StandingsPanel
        competitionId={competitionId}
        standings={standings}
        isLoading={standingsLoading}
      />

      <YourCompetitionPanel
        competitionId={competitionId}
        isSignedIn={isSignedIn}
        isLoading={myLoading}
        name={userName}
        enrolledTrackIds={enrolledTrackIds}
        submissionCount={mySubmissionCount}
        standings={standings}
      />

      <LeaderboardsPanel competitionId={competitionId} leaderboards={leaderboards} />
    </aside>
  );
}
