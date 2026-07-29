import { CompetitionPageHeader } from "*/components/competition-page-header";
import { HeaderMeta, PageBody } from "*/components/page-header-band";
import { PageSkeleton } from "*/components/skeletons";
import { SubmissionBrowser } from "*/components/submission-browser";
import { Button } from "*/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "src/lib/auth-client";
import { useCompetition } from "src/lib/competition-fn";
import { useCompetitionSubmissions } from "src/lib/submission-fn";

export const Route = createFileRoute("/competitions/$id/submissions/")({
  component: CompetitionSubmissionsPage,
});

function CompetitionSubmissionsPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: submissions = [], isLoading: submissionsLoading } =
    useCompetitionSubmissions(session?.user?.id, id);

  if (!competition) return <PageSkeleton />;

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
            render={
              <Link to="/competitions/$id/submissions/new" params={{ id }} />
            }
          >
            New submission
          </Button>
        }
        meta={
          session?.user ? (
            <HeaderMeta>
              <span>
                <b>{submissions.length}</b>{" "}
                {submissions.length === 1 ? "submission" : "submissions"}
              </span>
            </HeaderMeta>
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
          emptyDescription="Enrol in a track and create a submission to start building your history."
        />
      </PageBody>
    </>
  );
}
