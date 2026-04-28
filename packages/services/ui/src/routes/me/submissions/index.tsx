import { SubmissionBrowser } from "*/components/submission-browser";
import { SectionHeader } from "*/components/section-header";
import { createFileRoute } from "@tanstack/react-router";
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
        />
      </div>
    </div>
  );
}
