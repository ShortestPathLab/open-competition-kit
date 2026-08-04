import { EnrolmentCard } from "@/components/enrolment-card";
import { Button } from "@/components/ui/button";
import type { TrackSummary } from "@/lib/competition-data";
import { Link } from "@tanstack/react-router";

/** Whether this competitor is signed in and enrolled, and how to become both. */
export function ReadinessCard({
  competitionId,
  track,
  isSignedIn,
  isLoading,
  isEnrolled,
}: {
  competitionId: string;
  track: TrackSummary;
  isSignedIn: boolean;
  isLoading: boolean;
  isEnrolled: boolean;
}) {
  return (
    <EnrolmentCard
      isSignedIn={isSignedIn}
      isLoading={isLoading}
      isEnrolled={isEnrolled}
      title="Track readiness"
      description={`Check whether ${track.name} is ready for submission.`}
      signInAction={<Button render={<Link to="/sign-in" />}>Sign in</Button>}
      enrolAction={
        <Button
          render={
            <Link
              to="/competitions/$id/enrol"
              params={{ id: competitionId }}
              search={{ trackId: track.id }}
            />
          }
        >
          Enrol in this track
        </Button>
      }
      submitAction={
        <Button
          variant="outline"
          render={
            <Link
              to="/competitions/$id/tracks/$trackId"
              params={{ id: competitionId, trackId: track.id }}
            />
          }
        >
          Open track
        </Button>
      }
    />
  );
}
