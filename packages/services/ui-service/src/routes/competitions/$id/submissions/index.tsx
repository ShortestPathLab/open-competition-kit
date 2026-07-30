import { CompetitionPageHeader } from "*/components/competition-page-header";
import { HeaderStats, PageBody } from "*/components/page-header-band";
import { Stat } from "*/components/stat-strip";
import { PageSkeleton } from "*/components/skeletons";
import { SubmissionBrowser } from "*/components/submission-browser";
import { Button } from "*/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "src/lib/auth-client";
import { useCompetition } from "src/lib/competition-fn";
import {
  useCompetitionSubmissions,
  useUserSubmissionOutcomes,
} from "src/lib/submission-fn";

export const Route = createFileRoute("/competitions/$id/submissions/")({
  component: CompetitionSubmissionsPage,
});

function CompetitionSubmissionsPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: submissions = [], isLoading: submissionsLoading } =
    useCompetitionSubmissions(session?.user?.id, id);
  // Every submission the reader owns, of which this page shows one
  // competition's worth. One query serves both lists and stays cached between
  // them.
  const { data: outcomes, isLoading: outcomesLoading } =
    useUserSubmissionOutcomes(session?.user?.id);

  if (!competition) return <PageSkeleton />;

  const tracksEntered = new Set(submissions.map((s) => s.trackId)).size;

  return (
    <>
      {/* The title says "Your submissions" while the crumb says "Submissions":
          the crumb names the section a reader is navigating, and the title
          names what is actually on the page, which is only ever their own. */}
      <CompetitionPageHeader
        competitionId={id}
        competitionName={competition.name}
        title="Your submissions"
        crumb="Submissions"
        description="Everything you have entered here, and a way back into the track it went to."
        actions={
          <Button
            size="lg"
            className="h-10 px-5"
            render={
              <Link to="/competitions/$id/submissions/new" params={{ id }} />
            }
          >
            New submission
          </Button>
        }
        // Only once there is a signed-in reader for these to be *about*. Signed
        // out, a strip of zeroes reads as a competition with nothing in it
        // rather than as a prompt to sign in.
        meta={
          session?.user ? (
            <HeaderStats>
              <Stat label="Submissions" value={submissions.length} />
              <Stat label="Tracks entered" value={tracksEntered} />
            </HeaderStats>
          ) : undefined
        }
        tabs
      />
      <PageBody>
        <SubmissionBrowser
          submissions={submissions}
          isSessionLoading={sessionLoading}
          isSignedIn={Boolean(session?.user)}
          isLoading={submissionsLoading}
          outcomes={outcomes}
          outcomesLoading={outcomesLoading}
          emptyDescription="Enrol in a track and create a submission to start building your history."
        />
      </PageBody>
    </>
  );
}
