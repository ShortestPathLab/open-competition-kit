import { SubmissionBrowser } from "*/components/submission-browser";
import { SectionHeader } from "*/components/section-header";
import { Button } from "*/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "src/lib/auth-client";
import { useUserSubmissions } from "src/lib/submission-fn";

export const Route = createFileRoute("/me/submissions/")({
  component: MeSubmissionsPage,
});

function MeSubmissionsPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: submissions = [], isLoading: submissionsLoading } =
    useUserSubmissions(session?.user?.id);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="My submissions"
        description="Browse every submission you've made across competitions and tracks."
      />
      <div>
        <SubmissionBrowser
          submissions={submissions}
          isSessionLoading={sessionLoading}
          isSignedIn={Boolean(session?.user)}
          isLoading={submissionsLoading}
          renderActions={(submission) => (
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  to="/competitions/$id/tracks/$trackId"
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
