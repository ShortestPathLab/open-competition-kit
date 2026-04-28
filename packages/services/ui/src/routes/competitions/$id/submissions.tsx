import { SubmissionBrowser } from "*/components/submission-browser";
import { SectionHeader } from "*/components/section-header";
import { Button } from "*/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "src/lib/auth-client";
import { useCompetition } from "src/lib/competition-fn";
import { useCompetitionSubmissions } from "src/lib/submission-fn";

export const Route = createFileRoute("/competitions/$id/submissions")({
  component: CompetitionSubmissionsPage,
});

function CompetitionSubmissionsPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: submissions = [], isLoading: submissionsLoading } =
    useCompetitionSubmissions(session?.user?.id, id);

  if (!competition) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="My submissions"
        description="Search your submissions in this competition and jump back into a track when needed."
      />
      <div>
        <SubmissionBrowser
          submissions={submissions}
          isSessionLoading={sessionLoading}
          isSignedIn={Boolean(session?.user)}
          isLoading={submissionsLoading}
          emptyDescription="Enrol in a track and create a submission to start building your history."
          renderActions={(submission) => (
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  to="/competitions/$id/tracks/$trackId/submit"
                  params={{
                    id: submission.competitionId,
                    trackId: submission.trackId,
                  }}
                />
              }
            >
              Open track
            </Button>
          )}
        />
      </div>
    </div>
  );
}
