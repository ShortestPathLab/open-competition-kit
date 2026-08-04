import { Button } from "@/components/ui/button";
import type { Phase } from "@/lib/competition-window";
import type { TrackWithReports } from "@/lib/track-list";
import { Link } from "@tanstack/react-router";

/**
 * The one action that makes sense for the state a track is in.
 *
 * A closed track keeps its row and trades its submit button for a way into the
 * results: the result is the reason to come back after a deadline.
 */
export function TrackAction({
  competitionId,
  track,
  phase,
  entered,
}: {
  competitionId: string;
  track: TrackWithReports;
  phase: Phase;
  entered: boolean;
}) {
  if (phase === "closed" || phase === "upcoming") {
    return (
      <Button
        variant="outline"
        size="sm"
        render={
          <Link
            to="/competitions/$id/tracks/$trackId"
            params={{ id: competitionId, trackId: track.id }}
          />
        }
      >
        {phase === "closed" ? "View results" : "Read the brief"}
      </Button>
    );
  }

  if (entered) {
    return (
      <Button
        size="sm"
        render={
          <Link
            to="/competitions/$id/submissions/new"
            params={{ id: competitionId }}
            search={{ trackId: track.id }}
          />
        }
      >
        New submission
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      render={
        <Link
          to="/competitions/$id/enrol"
          params={{ id: competitionId }}
          search={{ trackId: track.id }}
        />
      }
    >
      Enter track
    </Button>
  );
}
