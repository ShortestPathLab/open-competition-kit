import { EnrolmentBrowser } from "*/components/enrolment-browser";
import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "src/lib/auth-client";
import { useUserEnrolments } from "src/lib/enrolment-fn";

export const Route = createFileRoute("/me/enrolments")({
  component: MeEnrolmentsPage,
});

function MeEnrolmentsPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: enrolments = [], isLoading } = useUserEnrolments(
    session?.user?.id,
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">My enrolments</h2>
        <p className="text-sm text-muted-foreground">
          Tracks you are currently participating in across competitions.
        </p>
      </div>
      <EnrolmentBrowser
        enrolments={enrolments}
        isSessionLoading={sessionLoading}
        isSignedIn={Boolean(session?.user)}
        isLoading={isLoading}
      />
    </div>
  );
}
