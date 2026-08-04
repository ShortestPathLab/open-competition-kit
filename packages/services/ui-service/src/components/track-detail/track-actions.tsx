import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

/**
 * One call to action, and it is whichever step the reader has not taken yet.
 *
 * The second button only appears once they are in, because there is nothing to
 * look back at before that.
 */
export function TrackActions({
  competitionId,
  trackId,
  isSignedIn,
  isLoading,
  isEnrolled,
}: {
  competitionId: string;
  trackId: string;
  isSignedIn: boolean;
  isLoading: boolean;
  isEnrolled: boolean;
}) {
  if (!isSignedIn) {
    return (
      <Button size="lg" className="h-10 px-5" render={<Link to="/sign-in" />}>
        Sign in to enrol
      </Button>
    );
  }

  // A placeholder rather than a guess. Showing "Enrol in this track" and
  // swapping it for "Make submission" once the answer arrives moves a button
  // that is already under somebody's cursor.
  if (isLoading) return <Skeleton className="h-10 w-44 rounded-lg" />;

  if (!isEnrolled) {
    return (
      <Button
        size="lg"
        className="h-10 px-5"
        render={
          <Link
            to="/competitions/$id/enrol"
            params={{ id: competitionId }}
            search={{ trackId }}
          />
        }
      >
        Enrol in this track
        <ArrowRight />
      </Button>
    );
  }

  return (
    <>
      <Button
        size="lg"
        className="h-10 px-5"
        render={
          <Link
            to="/competitions/$id/submissions/new"
            params={{ id: competitionId }}
            search={{ trackId }}
          />
        }
      >
        Make submission
        <ArrowRight />
      </Button>
      <Button
        size="lg"
        className="h-10 px-5"
        variant="outline"
        render={
          <Link
            to="/competitions/$id/submissions"
            params={{ id: competitionId }}
          />
        }
      >
        Your submissions
      </Button>
    </>
  );
}
